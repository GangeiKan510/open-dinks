"use server";

import { parseSkillTier, type SkillTier } from "@/lib/skill-tier";
import { DEFAULT_COURT_COUNT, normalizeCourtCount } from "@/lib/court-count";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { reduce, type SessionMode } from "@/engine";
import { ensureSingleLiveSession } from "@/lib/live-session";
import { dbToEngineState } from "@/lib/session-mapper";
import { loadSessionBundle } from "@/lib/session-bundle";
import { planSessionPersist } from "@/lib/session-persist";

/** Violation of sessions_one_live_per_venue. */
const PG_UNIQUE_VIOLATION = "23505";

/**
 * Goes live for a venue. A venue may only have one live session at a time, so
 * if one is already running the host is sent to it instead of opening a second.
 */
export async function createSessionAction(formData: FormData): Promise<void> {
  const venueId = String(formData.get("venueId") ?? "");
  const title = String(formData.get("title") ?? "Open Play").trim();
  const mode = "rotating" as const;
  const courtCount = normalizeCourtCount(
    formData.get("courtCount"),
    DEFAULT_COURT_COUNT,
  );

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const alreadyLive = await ensureSingleLiveSession(supabase, venueId);
  if (alreadyLive) {
    revalidatePath("/dashboard");
    redirect(`/s/${alreadyLive.public_token}/host`);
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      venue_id: venueId,
      title,
      mode,
      court_count: courtCount,
      status: "live",
      started_at: new Date().toISOString(),
      created_by: user.id,
    })
    .select("public_token")
    .single();

  // Lost a race against a concurrent "Go live": join the winner rather than
  // leaving the host on a form that appears to have done nothing.
  if (error?.code === PG_UNIQUE_VIOLATION) {
    const winner = await ensureSingleLiveSession(supabase, venueId);
    if (winner) {
      revalidatePath("/dashboard");
      redirect(`/s/${winner.public_token}/host`);
    }
    return;
  }

  if (error || !session) return;

  revalidatePath("/dashboard");
  redirect(`/s/${session.public_token}/host`);
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

async function loadSessionBundleForPersist(token: string) {
  const bundle = await loadSessionBundle(token);
  if (!bundle) return null;
  return {
    session: bundle.session,
    players: bundle.players,
    matches: bundle.matches,
    courts: bundle.courts,
    pairings: bundle.pairings,
    bookings: bundle.bookings,
    coachingBookings: bundle.coachingBookings,
  };
}

async function persistEngineDiff(
  token: string,
  mutate: (
    state: ReturnType<typeof dbToEngineState>,
  ) => ReturnType<typeof dbToEngineState>,
) {
  const bundle = await loadSessionBundleForPersist(token);
  if (!bundle) return { error: "Session not found" };

  const before = dbToEngineState(bundle);
  const after = mutate(before);
  const supabase = await createClient();
  const plan = planSessionPersist({
    sessionId: bundle.session.id,
    before,
    after,
    players: bundle.players,
    matches: bundle.matches,
    courts: bundle.courts,
    pairings: bundle.pairings,
  });

  const idMap = new Map<string, string>();
  const mapId = (id: string) => idMap.get(id) ?? id;
  const mapIds = (ids: string[]) => ids.map(mapId);

  const inserted = await Promise.all(
    plan.playerInserts.map(async (insert) => {
      const { data, error } = await supabase
        .from("session_players")
        .insert(insert.row)
        .select("id")
        .single();
      return { insert, data, error };
    }),
  );
  for (const row of inserted) {
    if (row.error || !row.data) {
      return { error: row.error?.message ?? "Failed to check in player" };
    }
    idMap.set(row.insert.tempId, row.data.id);
  }

  const newPlayerLockUpdates = plan.playerInserts.flatMap((insert) => {
    const player = after.players.find((row) => row.id === insert.tempId);
    if (!player) return [];
    const partnerLockId = player.partnerLockId
      ? mapId(player.partnerLockId)
      : null;
    const avoidIds = (player.avoidIds ?? []).map(mapId);
    if (!partnerLockId && avoidIds.length === 0) return [];
    return [
      {
        id: mapId(insert.tempId),
        patch: {
          partner_lock_id: partnerLockId,
          avoid_ids: avoidIds,
        },
      },
    ];
  });

  await Promise.all([
    ...plan.playerUpdates.map(({ id, patch }) =>
      supabase
        .from("session_players")
        .update({
          ...patch,
          partner_lock_id: patch.partner_lock_id
            ? mapId(patch.partner_lock_id)
            : null,
          avoid_ids: (patch.avoid_ids ?? []).map(mapId),
        })
        .eq("id", mapId(id)),
    ),
    ...newPlayerLockUpdates.map(({ id, patch }) =>
      supabase.from("session_players").update(patch).eq("id", id),
    ),
  ]);

  await Promise.all(
    plan.matchUpdates.map(({ id, patch }) =>
      supabase
        .from("matches")
        .update({
          ...patch,
          team_a: patch.team_a ? mapIds(patch.team_a) : patch.team_a,
          team_b: patch.team_b ? mapIds(patch.team_b) : patch.team_b,
        })
        .eq("id", id),
    ),
  );

  if (plan.matchDeletes.length > 0) {
    await supabase.from("matches").delete().in("id", plan.matchDeletes);
  }

  if (plan.matchInserts.length > 0) {
    await supabase.from("matches").insert(
      plan.matchInserts.map((row) => ({
        ...row,
        team_a: mapIds(row.team_a),
        team_b: mapIds(row.team_b),
      })),
    );
  }

  if (plan.sessionPatch) {
    await supabase
      .from("sessions")
      .update(plan.sessionPatch)
      .eq("id", bundle.session.id);
  }

  if (plan.pairingUpserts.length > 0) {
    await supabase.from("pairing_history").upsert(
      plan.pairingUpserts.map((row) => {
        const playerA = mapId(row.player_a);
        const playerB = mapId(row.player_b);
        const [low, high] =
          playerA < playerB ? [playerA, playerB] : [playerB, playerA];
        return {
          ...row,
          player_a: low,
          player_b: high,
        };
      }),
    );
  }

  revalidatePath(`/s/${token}`);
  revalidatePath(`/s/${token}/host`);
  revalidatePath(`/s/${token}/board`);
  return { ok: true as const };
}

export async function hostDispatchAction(
  token: string,
  action:
    | { type: "FILL_COURTS"; courtIds?: string[] }
    | { type: "PUSH_TO_COURT"; courtId: string }
    | { type: "REORDER_WAITING_QUEUE"; playerIds: string[] }
    | {
        type: "MOVE_WAITING_QUEUE";
        playerId: string;
        direction: "up" | "down";
      }
    | { type: "START_MATCH"; matchId: string }
    | { type: "RETURN_TO_STACK"; matchId: string }
    | { type: "COMPLETE_MATCH"; matchId: string; winner: "a" | "b" }
    | { type: "SET_MODE"; mode: SessionMode }
    | { type: "SET_MAX_GAME_MINUTES"; minutes: number }
    | { type: "SHUFFLE_TEAMS"; matchId: string }
    | {
        type: "CHECK_IN";
        name: string;
        skill: SkillTier;
      }
    | {
        type: "SET_STATUS";
        playerId: string;
        status: "waiting" | "resting" | "left";
      }
    | {
        type: "SET_PARTNER_LOCK";
        playerId: string;
        partnerId: string | null;
      }
    | { type: "SET_TEAM_LOCK"; playerIds: string[] }
    | { type: "CLEAR_TEAM_LOCK"; playerId: string },
) {
  return persistEngineDiff(token, (state) => {
    if (action.type === "CHECK_IN") {
      return reduce(state, {
        type: "CHECK_IN",
        player: {
          id: `tmp_${Date.now()}`,
          name: action.name,
          skill: action.skill,
        },
      });
    }
    return reduce(state, action);
  });
}

export async function guestCheckInAction(
  token: string,
  name: string,
  skill: SkillTier,
) {
  const bundle = await loadSessionBundle(token);
  if (!bundle || bundle.session.status !== "live") {
    return { error: "Session not available" };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("session_players").insert({
    session_id: bundle.session.id,
    display_name: name.trim(),
    skill,
    status: "waiting",
  });
  if (error) return { error: error.message };
  revalidatePath(`/s/${token}`);
  return { ok: true as const };
}

export async function endSessionAction(token: string) {
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("sessions")
    .select("id, public_token")
    .eq("public_token", token)
    .single();
  if (!session) return { error: "Not found" };

  await supabase
    .from("sessions")
    .update({
      status: "completed",
      ended_at: new Date().toISOString(),
    })
    .eq("id", session.id);

  revalidatePath(`/s/${token}`);
  revalidatePath(`/s/${token}/host`);
  // Frees the venue's single live slot, so the dashboard can offer "Go live".
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function addRosterPlayerAction(formData: FormData): Promise<void> {
  const venueId = String(formData.get("venueId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const skill = parseSkillTier(String(formData.get("skill")));
  if (!venueId || !name) return;

  const supabase = await createClient();
  await supabase.from("players").insert({
    venue_id: venueId,
    name,
    skill,
  });
  revalidatePath("/dashboard");
}
