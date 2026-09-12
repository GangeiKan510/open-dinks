import { describe, expect, it } from "vitest";
import { createInitialState, occupiedMatches, reduce } from "@/engine";
import type { EngineState } from "@/engine";
import type { Database } from "@/lib/supabase/database.types";
import { persistWriteCount, planSessionPersist } from "./session-persist";

type SessionPlayerRow = Database["public"]["Tables"]["session_players"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type PairingRow = Database["public"]["Tables"]["pairing_history"]["Row"];

function checkInMany(state: EngineState, names: string[]) {
  let next = state;
  for (const name of names) {
    next = reduce(next, {
      type: "CHECK_IN",
      player: { id: name.toLowerCase(), name, skill: "intermediate" },
    });
  }
  return next;
}

function playerRow(
  state: EngineState,
  id: string,
  sessionId = "session-1",
): SessionPlayerRow {
  const player = state.players.find((row) => row.id === id);
  if (!player) throw new Error(`Missing player ${id}`);
  return {
    id: player.id,
    session_id: sessionId,
    player_id: null,
    display_name: player.name,
    skill: player.skill,
    status: player.status,
    games_played: player.gamesPlayed,
    last_played_at: player.lastPlayedAt
      ? new Date(player.lastPlayedAt).toISOString()
      : null,
    checked_in_at: new Date(player.checkedInAt).toISOString(),
    partner_lock_id: player.partnerLockId ?? null,
    avoid_ids: player.avoidIds ?? [],
    consecutive_wins: player.consecutiveWins ?? 0,
    queue_order: player.queueOrder ?? null,
    team_lock_group_id: player.teamLockGroupId ?? null,
  };
}

function matchRow(state: EngineState, sessionId = "session-1"): MatchRow[] {
  return state.matches.map((match) => ({
    id: match.id,
    session_id: sessionId,
    court_id: match.courtId,
    court_name: match.courtName,
    team_a: match.teamA,
    team_b: match.teamB,
    status: match.status,
    winner: match.winner ?? null,
    started_at: match.startedAt
      ? new Date(match.startedAt).toISOString()
      : null,
    ended_at: match.endedAt ? new Date(match.endedAt).toISOString() : null,
  }));
}

function planFrom(before: EngineState, after: EngineState) {
  return planSessionPersist({
    sessionId: "session-1",
    before,
    after,
    players: before.players.map((player) => playerRow(before, player.id)),
    matches: matchRow(before),
    courts: [{ id: "c1", name: "Court 1" }],
    pairings: Object.keys(before.partnerHistory).map((key) => {
      const [player_a, player_b] = key.split("|") as [string, string];
      return {
        session_id: "session-1",
        player_a,
        player_b,
        as_partners: before.partnerHistory[key] ?? 0,
        as_opponents: before.opponentHistory[key] ?? 0,
      } satisfies PairingRow;
    }),
  });
}

describe("planSessionPersist", () => {
  it("writes nothing when the engine state did not change", () => {
    let state = createInitialState({
      now: 1_000,
      courts: [{ id: "c1", name: "Court 1" }],
    });
    state = checkInMany(state, ["A", "B", "C", "D"]);
    const plan = planFrom(state, state);
    expect(persistWriteCount(plan)).toBe(0);
    expect(plan.sessionPatch).toBeNull();
  });

  it("skips unchanged waiting players and the session row on fill courts", () => {
    let before = createInitialState({
      now: 1_000,
      courts: [{ id: "c1", name: "Court 1" }],
    });
    before = checkInMany(before, ["A", "B", "C", "D", "E", "F", "G", "H"]);
    const after = reduce(before, { type: "FILL_COURTS" });

    const plan = planFrom(before, after);
    expect(plan.playerInserts).toHaveLength(0);
    expect(plan.playerUpdates).toHaveLength(4);
    expect(
      plan.playerUpdates.every((row) => row.patch.status === "playing"),
    ).toBe(true);
    expect(plan.matchInserts).toHaveLength(1);
    expect(plan.matchUpdates).toHaveLength(0);
    expect(plan.sessionPatch).toBeNull();
    expect(plan.pairingUpserts).toHaveLength(0);
    expect(persistWriteCount(plan)).toBe(5);
  });

  it("plans a single player insert for check-in", () => {
    const before = createInitialState({
      now: 1_000,
      courts: [{ id: "c1", name: "Court 1" }],
    });
    const after = reduce(before, {
      type: "CHECK_IN",
      player: { id: "tmp_1", name: "Ada", skill: "intermediate" },
    });
    const plan = planFrom(before, after);
    expect(plan.playerInserts).toEqual([
      expect.objectContaining({
        tempId: "tmp_1",
        row: expect.objectContaining({
          display_name: "Ada",
          status: "waiting",
        }),
      }),
    ]);
    expect(plan.playerUpdates).toHaveLength(0);
    expect(plan.sessionPatch).toBeNull();
  });

  it("writes a session patch only when mode or timer changes", () => {
    const before = createInitialState({
      now: 1_000,
      courts: [{ id: "c1", name: "Court 1" }],
    });
    const after = reduce(before, { type: "SET_MODE", mode: "singles" });
    const plan = planFrom(before, after);
    expect(plan.sessionPatch).toEqual({
      mode: "singles",
      max_game_minutes: before.maxGameMinutes,
    });
    expect(persistWriteCount(plan)).toBe(1);
  });

  it("completes an occupied match without rewriting unchanged pairings", () => {
    let before = createInitialState({
      now: 1_000,
      courts: [{ id: "c1", name: "Court 1" }],
    });
    before = checkInMany(before, ["A", "B", "C", "D"]);
    before = reduce(before, { type: "FILL_COURTS" });
    const ready = occupiedMatches(before)[0];
    before = reduce(before, { type: "START_MATCH", matchId: ready.id });
    const active = occupiedMatches(before)[0];

    const after = reduce(before, {
      type: "COMPLETE_MATCH",
      matchId: active.id,
      winner: "a",
    });
    const plan = planFrom(before, after);

    expect(plan.matchUpdates).toHaveLength(1);
    expect(plan.matchUpdates[0]?.patch.status).toBe("completed");
    expect(plan.matchDeletes).toHaveLength(0);
    expect(plan.pairingUpserts.length).toBeGreaterThan(0);
  });
});
