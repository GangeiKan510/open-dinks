import { describe, expect, it } from "vitest";
import type { SkillTier } from "@/lib/skill-tier";
import { DEFAULT_SKILL_TIER } from "@/lib/skill-tier";
import {
  createInitialState,
  formatTimer,
  isMatchOvertime,
  matchElapsedMs,
  matchRemainingMs,
  occupiedMatches,
  orderedWaitingPlayers,
  reduce,
} from "./index";

function checkInMany(
  state: ReturnType<typeof createInitialState>,
  names: string[],
  skill: SkillTier = DEFAULT_SKILL_TIER,
) {
  let next = state;
  for (const name of names) {
    next = reduce(next, {
      type: "CHECK_IN",
      player: { id: name.toLowerCase(), name, skill },
    });
  }
  return next;
}

describe("court timers and start match", () => {
  it("FILL_COURTS stages matches as ready without starting the timer", () => {
    let state = createInitialState({
      now: 1_000,
      courts: [{ id: "c1", name: "Court 1" }],
      maxGameMinutes: 12,
    });
    state = checkInMany(state, ["A", "B", "C", "D"]);
    state = reduce(state, { type: "FILL_COURTS" });

    const match = occupiedMatches(state)[0];
    expect(match.status).toBe("ready");
    expect(match.startedAt).toBeNull();
    expect(state.players.every((p) => p.status === "playing")).toBe(true);
  });

  it("START_MATCH begins the timer on a ready court", () => {
    let state = createInitialState({
      now: 5_000,
      courts: [{ id: "c1", name: "Court 1" }],
      maxGameMinutes: 10,
    });
    state = checkInMany(state, ["A", "B", "C", "D"]);
    state = reduce(state, { type: "FILL_COURTS" });
    const matchId = occupiedMatches(state)[0].id;

    state = reduce(state, { type: "TICK", now: 8_000 });
    state = reduce(state, { type: "START_MATCH", matchId });

    const match = state.matches.find((m) => m.id === matchId)!;
    expect(match.status).toBe("active");
    expect(match.startedAt).toBe(8_000);
  });

  it("does not start an already active match again", () => {
    let state = createInitialState({
      now: 1_000,
      courts: [{ id: "c1", name: "Court 1" }],
    });
    state = checkInMany(state, ["A", "B", "C", "D"]);
    state = reduce(state, { type: "FILL_COURTS" });
    const matchId = occupiedMatches(state)[0].id;
    state = reduce(state, { type: "START_MATCH", matchId });
    const startedAt = state.matches.find((m) => m.id === matchId)!.startedAt;

    state = reduce(state, { type: "TICK", now: 50_000 });
    state = reduce(state, { type: "START_MATCH", matchId });

    expect(state.matches.find((m) => m.id === matchId)!.startedAt).toBe(
      startedAt,
    );
  });

  it("SET_MAX_GAME_MINUTES updates session timer settings", () => {
    let state = createInitialState({ maxGameMinutes: 15 });
    state = reduce(state, { type: "SET_MAX_GAME_MINUTES", minutes: 20 });
    expect(state.maxGameMinutes).toBe(20);

    state = reduce(state, { type: "SET_MAX_GAME_MINUTES", minutes: 0 });
    expect(state.maxGameMinutes).toBe(1);

    state = reduce(state, { type: "SET_MAX_GAME_MINUTES", minutes: 99 });
    expect(state.maxGameMinutes).toBe(60);
  });

  it("flags time up when elapsed reaches max game minutes", () => {
    let state = createInitialState({
      now: 0,
      courts: [{ id: "c1", name: "Court 1" }],
      maxGameMinutes: 15,
    });
    state = checkInMany(state, ["A", "B", "C", "D"]);
    state = reduce(state, { type: "FILL_COURTS" });
    const match = occupiedMatches(state)[0];
    state = reduce(state, { type: "START_MATCH", matchId: match.id });

    const started = state.matches.find((m) => m.id === match.id)!;
    expect(isMatchOvertime(started, state.maxGameMinutes, 14 * 60_000)).toBe(
      false,
    );
    expect(isMatchOvertime(started, state.maxGameMinutes, 16 * 60_000)).toBe(
      true,
    );
    expect(matchRemainingMs(started, state.maxGameMinutes, 10 * 60_000)).toBe(
      5 * 60_000,
    );
    expect(matchElapsedMs(started, 90_000)).toBe(90_000);
    expect(formatTimer(90_000)).toBe("1:30");
    expect(formatTimer(0)).toBe("0:00");
  });

  it("ready courts block fill and must be started before scoring", () => {
    let state = createInitialState({
      now: 1_000,
      courts: [{ id: "c1", name: "Court 1" }],
    });
    state = checkInMany(state, ["A", "B", "C", "D", "E", "F", "G", "H"]);
    state = reduce(state, { type: "FILL_COURTS" });
    expect(occupiedMatches(state)).toHaveLength(1);

    state = reduce(state, { type: "FILL_COURTS" });
    expect(occupiedMatches(state)).toHaveLength(1);

    const matchId = occupiedMatches(state)[0].id;
    const before = reduce(state, {
      type: "COMPLETE_MATCH",
      matchId,
      winner: "a",
    });
    expect(before.matches.find((m) => m.id === matchId)?.status).toBe("ready");

    state = reduce(state, { type: "START_MATCH", matchId });
    state = reduce(state, {
      type: "COMPLETE_MATCH",
      matchId,
      winner: "a",
    });
    expect(state.matches.find((m) => m.id === matchId)?.status).toBe(
      "completed",
    );
  });

  it("RETURN_TO_STACK puts ready court players first on the waiting stack without refill", () => {
    let state = createInitialState({
      now: 1_000,
      courts: [{ id: "c1", name: "Court 1" }],
    });
    state = checkInMany(state, ["A", "B", "C", "D", "E", "F", "G", "H"]);
    state = reduce(state, { type: "FILL_COURTS" });
    const match = occupiedMatches(state)[0];
    expect(match.status).toBe("ready");
    const courtPlayerIds = [...match.teamA, ...match.teamB];

    state = reduce(state, { type: "RETURN_TO_STACK", matchId: match.id });

    expect(occupiedMatches(state)).toHaveLength(0);
    expect(state.matches.find((m) => m.id === match.id)?.status).toBe(
      "completed",
    );
    expect(
      state.players
        .filter((p) => courtPlayerIds.includes(p.id))
        .every((p) => p.status === "waiting" && p.gamesPlayed === 0),
    ).toBe(true);

    const waitingNames = orderedWaitingPlayers(state).map((p) => p.name);
    const returnedNames = courtPlayerIds.map(
      (id) => state.players.find((p) => p.id === id)!.name,
    );
    expect(waitingNames.slice(0, 4)).toEqual(returnedNames);
    expect(waitingNames.slice(4)).toEqual(["E", "F", "G", "H"]);
  });

  it("RETURN_TO_STACK ends an active match and leaves the court empty", () => {
    let state = createInitialState({
      now: 1_000,
      courts: [{ id: "c1", name: "Court 1" }],
    });
    state = checkInMany(state, ["A", "B", "C", "D", "E", "F", "G", "H"]);
    state = reduce(state, { type: "FILL_COURTS" });
    const match = occupiedMatches(state)[0];
    const courtPlayerIds = [...match.teamA, ...match.teamB];
    state = reduce(state, { type: "START_MATCH", matchId: match.id });

    state = reduce(state, { type: "RETURN_TO_STACK", matchId: match.id });

    expect(occupiedMatches(state)).toHaveLength(0);
    expect(state.matches.find((m) => m.id === match.id)?.status).toBe(
      "completed",
    );
    expect(
      state.players
        .filter((p) => courtPlayerIds.includes(p.id))
        .every((p) => p.status === "waiting" && p.gamesPlayed === 1),
    ).toBe(true);

    const waitingNames = orderedWaitingPlayers(state).map((p) => p.name);
    const returnedNames = courtPlayerIds.map(
      (id) => state.players.find((p) => p.id === id)!.name,
    );
    expect(waitingNames.slice(0, 4)).toEqual(["E", "F", "G", "H"]);
    expect(waitingNames.slice(4)).toEqual(returnedNames);
  });
});
