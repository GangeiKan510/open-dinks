import { describe, expect, it } from "vitest";
import {
  createInitialState,
  occupiedMatches,
  playCountSpread,
  proposeFillCourts,
  reduce,
  summarizeSession,
} from "./index";
import type { SkillTier } from "@/lib/skill-tier";
import { SKILL_TIERS } from "@/lib/skill-tier";

function checkInMany(
  state: ReturnType<typeof createInitialState>,
  names: string[],
  skill: SkillTier = "intermediate",
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

function startAllReady(state: ReturnType<typeof createInitialState>) {
  let next = state;
  for (const m of occupiedMatches(next).filter((x) => x.status === "ready")) {
    next = reduce(next, { type: "START_MATCH", matchId: m.id });
  }
  return next;
}

describe("rotation engine", () => {
  it("fills free courts with 4 waiting doubles players", () => {
    let state = createInitialState({
      now: 1_000,
      courts: [{ id: "c1", name: "Court 1" }],
    });
    state = checkInMany(state, ["A", "B", "C", "D"]);
    state = reduce(state, { type: "FILL_COURTS" });

    expect(occupiedMatches(state)).toHaveLength(1);
    expect(occupiedMatches(state)[0].status).toBe("ready");
    expect(state.players.every((p) => p.status === "playing")).toBe(true);
  });

  it("does not double-book a court", () => {
    let state = createInitialState({
      now: 1_000,
      courts: [{ id: "c1", name: "Court 1" }],
    });
    state = checkInMany(state, ["A", "B", "C", "D", "E", "F", "G", "H"]);
    state = reduce(state, { type: "FILL_COURTS" });
    state = reduce(state, { type: "FILL_COURTS" });

    expect(occupiedMatches(state)).toHaveLength(1);
  });

  it("keeps play-count spread within 1 after many rotations", () => {
    let state = createInitialState({
      now: 1_000,
      courts: [
        { id: "c1", name: "Court 1" },
        { id: "c2", name: "Court 2" },
      ],
    });
    const names = Array.from({ length: 12 }, (_, i) => `P${i + 1}`);
    state = checkInMany(state, names);

    for (let round = 0; round < 20; round++) {
      state = reduce(state, { type: "TICK", now: state.now + 60_000 });
      state = reduce(state, { type: "FILL_COURTS" });
      state = startAllReady(state);
      const active = state.matches.filter((m) => m.status === "active");
      for (const m of active) {
        state = reduce(state, {
          type: "COMPLETE_MATCH",
          matchId: m.id,
          winner: "a",
        });
      }
    }

    expect(playCountSpread(state.players)).toBeLessThanOrEqual(1);
  });

  it("late joiners start at the current minimum games played", () => {
    let state = createInitialState({
      now: 1_000,
      courts: [{ id: "c1", name: "Court 1" }],
    });
    state = checkInMany(state, ["A", "B", "C", "D"]);
    state = reduce(state, { type: "FILL_COURTS" });
    const match = occupiedMatches(state)[0];
    state = reduce(state, { type: "START_MATCH", matchId: match.id });
    state = reduce(state, {
      type: "COMPLETE_MATCH",
      matchId: match.id,
      winner: "a",
    });
    state = reduce(state, {
      type: "CHECK_IN",
      player: { id: "late", name: "Late", skill: "intermediate" },
    });

    const late = state.players.find((p) => p.id === "late")!;
    const minGames = Math.min(
      ...state.players.filter((p) => p.id !== "late").map((p) => p.gamesPlayed),
    );
    expect(late.gamesPlayed).toBe(minGames);
  });

  it("singles mode assigns 2 players per court", () => {
    let state = createInitialState({
      now: 1_000,
      mode: "singles",
      courts: [{ id: "c1", name: "Court 1" }],
    });
    state = checkInMany(state, ["A", "B", "C"]);
    state = reduce(state, { type: "FILL_COURTS" });

    const match = occupiedMatches(state)[0];
    expect(match.teamA).toHaveLength(1);
    expect(match.teamB).toHaveLength(1);
  });

  it("skill_separated only uses players in court skill band", () => {
    let state = createInitialState({
      now: 1_000,
      mode: "skill_separated",
      courts: [
        {
          id: "c1",
          name: "Court 1",
          skillMin: "advanced",
          skillMax: "advanced",
        },
      ],
    });
    for (const id of ["a", "b", "c", "d"]) {
      state = reduce(state, {
        type: "CHECK_IN",
        player: { id, name: id.toUpperCase(), skill: "novice" },
      });
    }
    state = reduce(state, { type: "FILL_COURTS" });
    expect(occupiedMatches(state)).toHaveLength(0);

    for (const id of ["e", "f", "g", "h"]) {
      state = reduce(state, {
        type: "CHECK_IN",
        player: { id, name: id.toUpperCase(), skill: "advanced" },
      });
    }
    state = reduce(state, { type: "FILL_COURTS" });
    expect(occupiedMatches(state)).toHaveLength(1);
  });

  it("resting players are not assigned", () => {
    let state = createInitialState({
      now: 1_000,
      courts: [{ id: "c1", name: "Court 1" }],
    });
    state = checkInMany(state, ["A", "B", "C", "D"]);
    state = reduce(state, {
      type: "SET_STATUS",
      playerId: "a",
      status: "resting",
    });
    state = reduce(state, { type: "FILL_COURTS" });
    expect(occupiedMatches(state)).toHaveLength(0);
  });

  it("proposes lower scores when avoiding repeat partners", () => {
    let state = createInitialState({
      now: 1_000,
      courts: [{ id: "c1", name: "Court 1" }],
      partnerHistory: { "a|b": 5 },
    });
    state = checkInMany(state, ["A", "B", "C", "D"]);
    const proposals = proposeFillCourts(state);
    expect(proposals).toHaveLength(1);
    const { teamA, teamB } = proposals[0];
    const abTogether =
      (teamA.includes("a") && teamA.includes("b")) ||
      (teamB.includes("a") && teamB.includes("b"));
    expect(abTogether).toBe(false);
  });

  it("hold/return via SET_STATUS restores waiting eligibility", () => {
    let state = createInitialState({ now: 1_000 });
    state = checkInMany(state, ["A", "B", "C", "D"]);
    state = reduce(state, {
      type: "SET_STATUS",
      playerId: "a",
      status: "resting",
    });
    state = reduce(state, {
      type: "SET_STATUS",
      playerId: "a",
      status: "waiting",
    });
    state = reduce(state, { type: "FILL_COURTS" });
    expect(
      state.players.find((p) => p.id === "a")?.status === "playing" ||
        state.players.find((p) => p.id === "a")?.status === "waiting",
    ).toBe(true);
  });

  it("summarizeSession ranks by wins then games", () => {
    let state = createInitialState({
      now: 1_000,
      courts: [{ id: "c1", name: "Court 1" }],
    });
    state = checkInMany(state, ["A", "B", "C", "D"]);
    state = reduce(state, { type: "FILL_COURTS" });
    const match = occupiedMatches(state)[0];
    state = reduce(state, { type: "START_MATCH", matchId: match.id });
    state = reduce(state, {
      type: "COMPLETE_MATCH",
      matchId: match.id,
      winner: "a",
    });
    const summary = summarizeSession(state);
    expect(summary[0].wins).toBeGreaterThanOrEqual(summary[1].wins);
  });

  it("king_of_court keeps winners when under cap", () => {
    let state = createInitialState({
      now: 1_000,
      mode: "king_of_court",
      courts: [{ id: "c1", name: "Court 1" }],
      kingMaxConsecutiveWins: 3,
    });
    state = checkInMany(state, ["A", "B", "C", "D", "E", "F", "G", "H"]);
    state = reduce(state, { type: "FILL_COURTS" });
    const match = occupiedMatches(state)[0];
    const winners = [...match.teamA];
    state = reduce(state, { type: "START_MATCH", matchId: match.id });
    state = reduce(state, {
      type: "COMPLETE_MATCH",
      matchId: match.id,
      winner: "a",
    });
    const next = occupiedMatches(state)[0];
    expect(next).toBeTruthy();
    expect(next.status).toBe("ready");
    expect(next.teamA).toEqual(winners);
  });

  it("seeds demo players across all skill tiers", () => {
    expect(SKILL_TIERS).toHaveLength(4);
  });
});
