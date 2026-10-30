import { describe, expect, it } from "vitest";
import {
  createInitialState,
  occupiedMatches,
  playersPerCourt,
  proposeFillCourts,
  reduce,
} from "./index";
import type { EnginePlayer, EngineState } from "./types";
import { pairKey } from "@/lib/utils";

function waiting(
  partial: Partial<EnginePlayer> & { id: string; name: string },
): EnginePlayer {
  return {
    skill: "intermediate",
    status: "waiting",
    gamesPlayed: 0,
    lastPlayedAt: null,
    checkedInAt: 1,
    queueOrder: 0,
    ...partial,
  };
}

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

describe("open play setup behavior", () => {
  it("counts one player a side when the format is singles", () => {
    expect(playersPerCourt({ mode: "rotating", format: "singles" })).toBe(2);
    expect(playersPerCourt("rotating")).toBe(4);

    let state = createInitialState({
      now: 1_000,
      format: "singles",
      mode: "rotating",
      courts: [{ id: "c1", name: "Court 1" }],
    });
    state = checkInMany(state, ["A", "B"]);
    state = reduce(state, { type: "FILL_COURTS" });
    const match = occupiedMatches(state)[0];
    expect(match.teamA).toHaveLength(1);
    expect(match.teamB).toHaveLength(1);
  });

  it("fills a court as soon as enough players check in when matching is auto", () => {
    let state = createInitialState({
      now: 1_000,
      matching: "auto",
      courts: [{ id: "c1", name: "Court 1" }],
    });
    state = checkInMany(state, ["A", "B", "C"]);
    expect(occupiedMatches(state)).toHaveLength(0);
    state = checkInMany(state, ["D"]);
    expect(occupiedMatches(state)).toHaveLength(1);
  });

  it("rests players who reach the game limit", () => {
    let state = createInitialState({
      now: 1_000,
      playerGameLimit: 1,
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
      scoreA: 11,
      scoreB: 7,
    });

    for (const id of ["a", "b", "c", "d"]) {
      expect(state.players.find((player) => player.id === id)?.status).toBe(
        "resting",
      );
    }
    const completed = state.matches.find((row) => row.id === match.id);
    expect(completed?.winner).toBe("a");
    expect(completed?.scoreA).toBe(11);
    expect(completed?.scoreB).toBe(7);
  });

  it("lets the higher score win when both scores are recorded", () => {
    let state = createInitialState({
      now: 1_000,
      scoreTracking: "scores",
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
      scoreA: 8,
      scoreB: 11,
    });
    expect(state.matches.find((row) => row.id === match.id)?.winner).toBe("b");
  });

  it("groups a rated court around the next player's skill", () => {
    const state = createInitialState({
      now: 1_000,
      mode: "rated",
      courts: [{ id: "c1", name: "Court 1" }],
      players: [
        waiting({ id: "a1", name: "A1", skill: "advanced", queueOrder: 0 }),
        waiting({ id: "b1", name: "B1", skill: "beginner", queueOrder: 1 }),
        waiting({ id: "a2", name: "A2", skill: "advanced", queueOrder: 2 }),
        waiting({ id: "a3", name: "A3", skill: "advanced", queueOrder: 3 }),
        waiting({ id: "a4", name: "A4", skill: "advanced", queueOrder: 4 }),
      ],
    });
    const proposal = proposeFillCourts(state)[0];
    const ids = [...proposal.teamA, ...proposal.teamB];
    expect(ids).toHaveLength(4);
    expect(ids).not.toContain("b1");
  });

  it("sends winners to one court and losers to the next", () => {
    const players = ["w1", "w2", "w3", "w4", "l1", "l2", "l3", "l4"].map(
      (id, index) =>
        waiting({
          id,
          name: id,
          queueOrder: index === 0 ? 1 : index,
          lastResult: id.startsWith("w") ? "win" : "loss",
        }),
    );
    players[4].queueOrder = 0;
    const state = createInitialState({
      now: 1_000,
      mode: "court_kings",
      courts: [
        { id: "c1", name: "Court 1" },
        { id: "c2", name: "Court 2" },
      ],
      players,
    });
    const proposals = proposeFillCourts(state);
    expect([...proposals[0].teamA, ...proposals[0].teamB].sort()).toEqual([
      "w1",
      "w2",
      "w3",
      "w4",
    ]);
    expect([...proposals[1].teamA, ...proposals[1].teamB].sort()).toEqual([
      "l1",
      "l2",
      "l3",
      "l4",
    ]);
  });

  it("prefers a new partner over an even-skill repeat in social shuffle", () => {
    const state = createInitialState({
      now: 1_000,
      mode: "social_shuffle",
      courts: [{ id: "c1", name: "Court 1" }],
      partnerHistory: {
        [pairKey("a", "c")]: 1,
        [pairKey("a", "d")]: 1,
      },
      players: [
        waiting({ id: "a", name: "A", skill: "advanced", queueOrder: 0 }),
        waiting({ id: "b", name: "B", skill: "advanced", queueOrder: 1 }),
        waiting({ id: "c", name: "C", skill: "beginner", queueOrder: 2 }),
        waiting({ id: "d", name: "D", skill: "beginner", queueOrder: 3 }),
      ],
    });
    const proposal = proposeFillCourts(state)[0];
    const sides = [
      proposal.teamA.slice().sort().join(","),
      proposal.teamB.slice().sort().join(","),
    ].sort();
    expect(sides).toEqual(["a,b", "c,d"]);
  });

  it("builds mixed teams and avoids a couple that already played together", () => {
    const state = createInitialState({
      now: 1_000,
      mode: "couple_hunt",
      courts: [{ id: "c1", name: "Court 1" }],
      partnerHistory: { [pairKey("m1", "w1")]: 1 },
      players: [
        waiting({ id: "m1", name: "M1", gender: "man", queueOrder: 0 }),
        waiting({ id: "m2", name: "M2", gender: "man", queueOrder: 1 }),
        waiting({ id: "w1", name: "W1", gender: "woman", queueOrder: 2 }),
        waiting({ id: "w2", name: "W2", gender: "woman", queueOrder: 3 }),
      ],
    });
    const proposal = proposeFillCourts(state)[0];
    for (const team of [proposal.teamA, proposal.teamB]) {
      expect(team).toHaveLength(2);
      expect(team.slice().sort().join()).not.toBe("m1,w1");
    }
  });

  it("varies all-random pairings as the clock changes", () => {
    const players = ["a", "b", "c", "d"].map((id, index) =>
      waiting({ id, name: id.toUpperCase(), queueOrder: index }),
    );
    const base = createInitialState({
      now: 0,
      mode: "all_random",
      courts: [{ id: "c1", name: "Court 1" }],
      players,
    });
    const signatures = new Set<string>();
    for (let now = 0; now < 40; now++) {
      const proposal = proposeFillCourts({ ...base, now })[0];
      signatures.add(
        `${proposal.teamA.slice().sort().join("+")}|${proposal.teamB.slice().sort().join("+")}`,
      );
    }
    expect(signatures.size).toBeGreaterThan(1);
  });

  it("treats a null game clock as no time limit", () => {
    const state = reduce(createInitialState({ maxGameMinutes: 15 }), {
      type: "SET_MAX_GAME_MINUTES",
      minutes: null,
    });
    expect(state.maxGameMinutes).toBeNull();
  });
});
