"use server";

import { cookies } from "next/headers";
import { type SkillTier } from "@/lib/skill-tier";
import { THEME_COOKIE } from "@/lib/theme";
import { parseOpenPlayForm } from "@/lib/open-play";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { reduce, type PlayerGender } from "@/engine";
import { type HostDispatch, renameNewMatches } from "@/lib/host-dispatch";
import { ensureSingleLiveSession } from "@/lib/live-session";
import { dbToEngineState } from "@/lib/session-mapper";
import { loadSessionBundle } from "@/lib/session-bundle";
import { loadSessionLiveRows } from "@/lib/session-live-rows";
import { planSessionPersist } from "@/lib/session-persist";
import { normalizeCourtCount } from "@/lib/court-count";

/** Violation of sessions_one_live_per_venue. */
const PG_UNIQUE_VIOLATION = "23505";

/**
 * Goes live for a venue. A venue may only have one live session at a time, so
 * if one is already running the host is sent to it instead of opening a second.
 */
export async function createSessionAction(formData: FormData): Promise<void> {
  const venueId = String(formData.get("venueId") ?? "");
  const setup = parseOpenPlayForm(formData);

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

  const { data: courts, error: courtsError } = await supabase
    .from("courts")
    .select("id")
    .eq("venue_id", venueId);
  if (courtsError || !courts) return;

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      venue_id: venueId,
      title: setup.title,
      mode: setup.mode,
      game_format: setup.format,
      score_tracking: setup.scoreTracking,
      player_game_limit: setup.playerGameLimit,
      matching: setup.matching,
      max_game_minutes: setup.maxGameMinutes,
      court_count: normalizeCourtCount(courts.length),
      status: "live",
      started_at: new Date().toISOString(),
      created_by: user.id,
    })
    .select("id, public_token")
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

  if (setup.playerNames.length > 0) {
    await supabase.from("session_players").insert(
      setup.playerNames.map((name, index) => ({
        session_id: session.id,
        display_name: name,
        skill: "intermediate" as const,
        status: "waiting" as const,
        queue_order: index,
      })),
    );
  }

  if (setup.matching === "auto") {
    await persistEngineDiff(session.public_token, (state) =>
      reduce(state, { type: "FILL_COURTS" }),
    );
  }

  revalidatePath("/dashboard");
  redirect(`/s/${session.public_token}/host`);
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const jar = await cookies();
  jar.delete(THEME_COOKIE);
  redirect("/");
}

async function loadSessionBundleForPersist(token: string) {
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("public_token", token)
    .single();
  if (!session) return null;

  const rows = await loadSessionLiveRows(supabase, session);
  return { supabase, session, ...rows };
}

async function persistEngineDiff(
  token: string,
  mutate: (
    state: ReturnType<typeof dbToEngineState>,
  ) => ReturnType<typeof dbToEngineState>,
) {
  const bundle = await loadSessionBundleForPersist(token);
  if (!bundle) return { error: "Session not found" };

  const { supabase } = bundle;
  const before = dbToEngineState(bundle);
  const after = mutate(before);
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

  const newEngineMatchIds = after.matches
    .filter(
      (match) =>
        (match.status === "ready" || match.status === "active") &&
        !before.matches.some((row) => row.id === match.id),
    )
    .map((match) => match.id);
  const matchIds: Record<string, string> = {};
  if (plan.matchInserts.length > 0) {
    const canMap = newEngineMatchIds.length === plan.matchInserts.length;
    const insertedMatches = await Promise.all(
      plan.matchInserts.map(async (row, index) => {
        const { data, error } = await supabase
          .from("matches")
          .insert({
            ...row,
            team_a: mapIds(row.team_a),
            team_b: mapIds(row.team_b),
          })
          .select("id")
          .single();
        return { index, data, error };
      }),
    );
    for (const row of insertedMatches) {
      if (row.error || !row.data) {
        console.error(row.error);
        return { error: "Failed to open a court" };
      }
      const engineId = newEngineMatchIds[row.index];
      if (canMap && engineId) matchIds[engineId] = row.data.id;
    }
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

  // Host, player, and board views refresh themselves, so the click returns
  // as soon as the rows are saved.
  return {
    ok: true as const,
    playerIds: Object.fromEntries(idMap),
    matchIds,
  };
}

export async function hostDispatchAction(
  token: string,
  action: HostDispatch,
  matchIds: string[] = [],
) {
  return persistEngineDiff(token, (state) => {
    const after =
      action.type === "CHECK_IN"
        ? reduce(state, {
            type: "CHECK_IN",
            player: {
              id: action.playerId,
              name: action.name,
              skill: action.skill,
              gender: action.gender ?? null,
            },
          })
        : reduce(state, action);
    return renameNewMatches(state, after, matchIds);
  });
}

export async function guestCheckInAction(
  token: string,
  name: string,
  skill: SkillTier,
  gender?: PlayerGender | null,
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
    gender: gender ?? null,
  });
  if (error) return { error: error.message };
  if (bundle.session.matching === "auto") {
    await persistEngineDiff(token, (state) =>
      reduce(state, { type: "FILL_COURTS" }),
    );
  }
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
