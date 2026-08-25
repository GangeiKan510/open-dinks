"use server";

import { parseSkillTier, type SkillTier } from "@/lib/skill-tier";
import {
  buildCourtNames,
  DEFAULT_COURT_COUNT,
  normalizeCourtCount,
} from "@/lib/court-count";
import {
  createFacilityForAccount,
  loadFacilityForAccount,
} from "@/lib/facility-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { reduce, type SessionMode } from "@/engine";
import { dbToEngineState } from "@/lib/session-mapper";

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

export async function createVenueAction(
  formData: FormData,
): Promise<{ error: string } | { ok: true; venueId: string }> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Venue name is required." };

  const facilityName =
    String(formData.get("facilityName") ?? "").trim() || name;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to create a venue." };

  // Venue.created_by requires a profiles row (created by auth trigger).
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    display_name:
      user.user_metadata?.display_name || user.email?.split("@")[0] || "Host",
  });
  if (profileError) {
    console.error("[venue] profile upsert failed", profileError);
    return {
      error:
        "Could not prepare your host profile. Apply the latest Supabase migrations, then try again.",
    };
  }

  const slugBase = slugify(name) || "venue";
  const slug = `${slugBase}-${Math.random().toString(36).slice(2, 6)}`;
  const courtCount = normalizeCourtCount(
    formData.get("courtCount"),
    DEFAULT_COURT_COUNT,
  );

  const existingFacility = await loadFacilityForAccount(user.id);
  let facilityId = existingFacility?.id ?? null;
  if (!facilityId) {
    const created = await createFacilityForAccount({ name: facilityName });
    if ("error" in created) return { error: created.error };
    facilityId = created.id;
  }

  const venueId = crypto.randomUUID();
  const { error } = await supabase.from("venues").insert({
    id: venueId,
    name,
    slug,
    created_by: user.id,
    facility_id: facilityId,
  });

  if (error) {
    console.error("[venue] create failed", error);
    const message = (error.message ?? "").toLowerCase();
    if (
      message.includes("facility_id") ||
      message.includes("does not exist") ||
      message.includes("schema cache")
    ) {
      return {
        error:
          "Venue schema is out of date. Run the latest Supabase migrations, then try again.",
      };
    }
    return { error: "Could not create venue. Try again." };
  }

  const { error: memberError } = await supabase.from("venue_members").insert({
    venue_id: venueId,
    user_id: user.id,
    role: "owner",
  });
  if (memberError) {
    console.error("[venue] member insert failed", memberError);
    return { error: "Venue created, but membership failed. Try again." };
  }

  const courts = buildCourtNames(courtCount).map((courtName, index) => ({
    venue_id: venueId,
    name: courtName,
    sort_order: index + 1,
  }));
  const { error: courtsError } = await supabase.from("courts").insert(courts);
  if (courtsError) {
    console.error("[venue] courts insert failed", courtsError);
    return { error: "Venue created, but courts failed to save. Try again." };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/venues/${venueId}`);
  return { ok: true as const, venueId };
}

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

  if (error || !session) return;

  revalidatePath(`/venues/${venueId}`);
  redirect(`/s/${session.public_token}/host`);
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

async function loadSessionBundle(token: string) {
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("public_token", token)
    .single();
  if (!session) return null;

  const [
    { data: players },
    { data: matches },
    { data: courts },
    { data: pairings },
  ] = await Promise.all([
    supabase.from("session_players").select("*").eq("session_id", session.id),
    supabase.from("matches").select("*").eq("session_id", session.id),
    supabase
      .from("courts")
      .select("*")
      .eq("venue_id", session.venue_id)
      .order("sort_order"),
    supabase.from("pairing_history").select("*").eq("session_id", session.id),
  ]);

  return {
    session,
    players: players ?? [],
    matches: matches ?? [],
    courts: courts ?? [],
    pairings: pairings ?? [],
  };
}

async function persistEngineDiff(
  token: string,
  mutate: (
    state: ReturnType<typeof dbToEngineState>,
  ) => ReturnType<typeof dbToEngineState>,
) {
  const bundle = await loadSessionBundle(token);
  if (!bundle) return { error: "Session not found" };

  const before = dbToEngineState(bundle);
  const after = mutate(before);
  const supabase = await createClient();
  const idMap = new Map<string, string>();

  const mapId = (id: string) => idMap.get(id) ?? id;
  const mapIds = (ids: string[]) => ids.map(mapId);

  for (const p of after.players) {
    const existing = bundle.players.find((x) => x.id === p.id);
    if (existing) {
      idMap.set(p.id, p.id);
      await supabase
        .from("session_players")
        .update({
          display_name: p.name,
          skill: p.skill,
          status: p.status,
          games_played: p.gamesPlayed,
          last_played_at: p.lastPlayedAt
            ? new Date(p.lastPlayedAt).toISOString()
            : null,
          avoid_ids: (p.avoidIds ?? []).map(mapId),
          consecutive_wins: p.consecutiveWins ?? 0,
          queue_order: p.queueOrder ?? null,
          team_lock_group_id: p.teamLockGroupId ?? null,
        })
        .eq("id", p.id);
    } else {
      const { data, error } = await supabase
        .from("session_players")
        .insert({
          session_id: bundle.session.id,
          display_name: p.name,
          skill: p.skill,
          status: p.status,
          games_played: p.gamesPlayed,
          partner_lock_id: null,
          avoid_ids: [],
          queue_order: p.queueOrder ?? null,
          team_lock_group_id: p.teamLockGroupId ?? null,
        })
        .select("id")
        .single();
      if (error || !data) {
        return { error: error?.message ?? "Failed to check in player" };
      }
      idMap.set(p.id, data.id);
    }
  }

  // Second pass for partner locks now that all IDs exist
  for (const p of after.players) {
    const realId = mapId(p.id);
    await supabase
      .from("session_players")
      .update({
        partner_lock_id: p.partnerLockId ? mapId(p.partnerLockId) : null,
        avoid_ids: (p.avoidIds ?? []).map(mapId),
      })
      .eq("id", realId);
  }

  const occupied = (status: string) =>
    status === "active" || status === "ready";
  const beforeOccupied = before.matches.filter((m) => occupied(m.status));
  const afterOccupied = after.matches.filter((m) => occupied(m.status));
  const afterCompleted = after.matches.filter((m) => m.status === "completed");

  for (const m of afterCompleted) {
    const wasOccupied = beforeOccupied.find((b) => b.id === m.id);
    if (wasOccupied) {
      await supabase
        .from("matches")
        .update({
          status: "completed",
          winner: m.winner ?? null,
          ended_at: m.endedAt
            ? new Date(m.endedAt).toISOString()
            : new Date().toISOString(),
          team_a: mapIds(m.teamA),
          team_b: mapIds(m.teamB),
        })
        .eq("id", m.id);
    }
  }

  for (const m of afterOccupied) {
    const exists = bundle.matches.find((x) => x.id === m.id);
    const startedAt =
      m.startedAt != null ? new Date(m.startedAt).toISOString() : null;
    if (!exists) {
      const court = bundle.courts.find((c) => c.id === m.courtId);
      await supabase.from("matches").insert({
        session_id: bundle.session.id,
        court_id: court?.id ?? null,
        court_name: m.courtName,
        team_a: mapIds(m.teamA),
        team_b: mapIds(m.teamB),
        status: m.status,
        started_at: startedAt,
      });
    } else {
      await supabase
        .from("matches")
        .update({
          team_a: mapIds(m.teamA),
          team_b: mapIds(m.teamB),
          status: m.status,
          started_at: startedAt,
        })
        .eq("id", m.id);
    }
  }

  for (const m of beforeOccupied) {
    const still = after.matches.find((x) => x.id === m.id);
    if (!still) {
      await supabase.from("matches").delete().eq("id", m.id);
    }
  }

  await supabase
    .from("sessions")
    .update({
      mode: after.mode,
      max_game_minutes: after.maxGameMinutes,
    })
    .eq("id", bundle.session.id);

  // Persist pairing history from engine maps
  const partnerKeys = new Set([
    ...Object.keys(after.partnerHistory),
    ...Object.keys(after.opponentHistory),
  ]);
  for (const key of partnerKeys) {
    const [a, b] = key.split("|");
    if (!a || !b) continue;
    const playerA = mapId(a);
    const playerB = mapId(b);
    const [low, high] =
      playerA < playerB ? [playerA, playerB] : [playerB, playerA];
    await supabase.from("pairing_history").upsert({
      session_id: bundle.session.id,
      player_a: low,
      player_b: high,
      as_partners: after.partnerHistory[key] ?? 0,
      as_opponents: after.opponentHistory[key] ?? 0,
    });
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
    | { type: "CLEAR_COURT"; matchId: string }
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
  revalidatePath(`/venues/${venueId}`);
}

export async function updateFacilityAction(formData: FormData): Promise<void> {
  const venueId = String(formData.get("venueId") ?? "");
  const facilityId = String(formData.get("facilityId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const shortName = String(formData.get("shortName") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim();
  if (!venueId || !facilityId || !name || !shortName) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("facilities")
    .update({
      name,
      short_name: shortName,
      tagline,
    })
    .eq("id", facilityId);

  if (error) return;

  revalidatePath(`/venues/${venueId}`);
  revalidatePath("/dashboard");
}
