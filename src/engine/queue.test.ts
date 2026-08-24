import { describe, expect, it } from "vitest";
import { createInitialState, reduce } from "./reducer";
import {
  groupWaitingStack,
  orderedWaitingPlayers,
  reorderWaitingStackIds,
} from "./queue";

function checkIn(state: ReturnType<typeof createInitialState>, name: string) {
  return reduce(state, {
    type: "CHECK_IN",
    player: { id: name.toLowerCase(), name, skill: "intermediate" },
  });
}

describe("waiting stack", () => {
  it("orders waiting players by queueOrder", () => {
    let state = createInitialState({ now: 1_000 });
    state = checkIn(state, "Alex");
    state = reduce(
      { ...state, now: 2_000 },
      {
        type: "CHECK_IN",
        player: { id: "blake", name: "Blake", skill: "intermediate" },
      },
    );
    state = reduce(state, {
      type: "REORDER_WAITING_QUEUE",
      playerIds: ["blake", "alex"],
    });

    expect(orderedWaitingPlayers(state).map((p) => p.name)).toEqual([
      "Blake",
      "Alex",
    ]);
  });

  it("MOVE_WAITING_QUEUE swaps adjacent players", () => {
    let state = createInitialState({ now: 1_000 });
    state = checkIn(state, "Alex");
    state = checkIn(state, "Blake");
    state = checkIn(state, "Casey");

    state = reduce(state, {
      type: "MOVE_WAITING_QUEUE",
      playerId: "casey",
      direction: "up",
    });

    expect(orderedWaitingPlayers(state).map((p) => p.name)).toEqual([
      "Alex",
      "Casey",
      "Blake",
    ]);
  });

  it("FILL_COURTS assigns from stack order, not games played", () => {
    let state = createInitialState({ now: 1_000 });
    ["Alex", "Blake", "Casey", "Drew"].forEach((name) => {
      state = checkIn(state, name);
    });
    state = reduce(state, {
      type: "REORDER_WAITING_QUEUE",
      playerIds: ["drew", "casey", "blake", "alex"],
    });
    state = reduce(state, {
      type: "SET_STATUS",
      playerId: "alex",
      status: "resting",
    });
    state = reduce(state, {
      type: "SET_STATUS",
      playerId: "alex",
      status: "waiting",
    });
    state = reduce(state, {
      type: "REORDER_WAITING_QUEUE",
      playerIds: ["alex", "drew", "casey", "blake"],
    });

    state = reduce(state, { type: "FILL_COURTS" });
    const match = state.matches.find((m) => m.status === "ready");
    expect(match).toBeTruthy();
    const assigned = [...(match?.teamA ?? []), ...(match?.teamB ?? [])].map(
      (id) => state.players.find((p) => p.id === id)?.name,
    );
    expect(assigned).toEqual(["Alex", "Drew", "Casey", "Blake"]);
  });

  it("reorderWaitingStackIds moves a player to a new slot", () => {
    expect(reorderWaitingStackIds(["a", "b", "c", "d"], "d", "b")).toEqual([
      "a",
      "d",
      "b",
      "c",
    ]);
    expect(reorderWaitingStackIds(["a", "b"], "a", "a")).toBeNull();
  });

  it("groups waiting players into court-sized chunks", () => {
    const players = [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
      { id: "c", name: "C" },
      { id: "d", name: "D" },
      { id: "e", name: "E" },
    ] as ReturnType<typeof orderedWaitingPlayers>;

    expect(
      groupWaitingStack(players, 4).map((g) => g.map((p) => p.name)),
    ).toEqual([["A", "B", "C", "D"], ["E"]]);
  });

  it("PUSH_TO_COURT only fills the requested court", () => {
    let state = createInitialState({
      now: 1_000,
      courts: [
        { id: "c1", name: "Court 1" },
        { id: "c2", name: "Court 2" },
      ],
    });
    ["A", "B", "C", "D", "E", "F", "G", "H"].forEach((name) => {
      state = checkIn(state, name);
    });

    state = reduce(state, { type: "PUSH_TO_COURT", courtId: "c2" });

    expect(state.matches.filter((m) => m.status === "ready")).toHaveLength(1);
    expect(state.matches[0]?.courtId).toBe("c2");
  });
});
