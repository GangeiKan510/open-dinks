import { describe, expect, it } from "vitest";
import { createInitialState, reduce } from "./reducer";
import {
  findSeparatedTeamLocks,
  formatSeparatedTeamLockMessage,
  takeNextCourtPlayers,
  validateTeamLockPlayerIds,
} from "./locks";
import { getStackPushBlockReason } from "./matchmaking";
import { orderedWaitingPlayers } from "./queue";

function checkIn(state: ReturnType<typeof createInitialState>, name: string) {
  return reduce(state, {
    type: "CHECK_IN",
    player: { id: name.toLowerCase(), name, skill: "intermediate" },
  });
}

describe("team lock", () => {
  it("validates exactly four waiting players for doubles", () => {
    let state = createInitialState();
    state = checkIn(state, "A");
    state = checkIn(state, "B");

    expect(
      validateTeamLockPlayerIds(state, ["a", "b", "c", "d"], "rotating"),
    ).toBe("Player not found.");
    expect(validateTeamLockPlayerIds(state, ["a", "b"], "rotating")).toBe(
      "Select exactly 4 players for a team lock.",
    );
  });

  it("SET_TEAM_LOCK assigns a shared group id", () => {
    let state = createInitialState();
    ["A", "B", "C", "D"].forEach((name) => {
      state = checkIn(state, name);
    });

    state = reduce(state, {
      type: "SET_TEAM_LOCK",
      playerIds: ["a", "b", "c", "d"],
    });

    const groupIds = orderedWaitingPlayers(state).map((p) => p.teamLockGroupId);
    expect(new Set(groupIds).size).toBe(1);
    expect(groupIds[0]).toBeTruthy();
  });

  it("takeNextCourtPlayers keeps a locked foursome together", () => {
    let state = createInitialState();
    ["A", "B", "C", "D", "E", "F", "G", "H"].forEach((name) => {
      state = checkIn(state, name);
    });
    state = reduce(state, {
      type: "SET_TEAM_LOCK",
      playerIds: ["e", "f", "g", "h"],
    });
    state = reduce(state, {
      type: "REORDER_WAITING_QUEUE",
      playerIds: ["a", "b", "c", "d", "e", "f", "g", "h"],
    });

    const pool = orderedWaitingPlayers(state);
    const group = takeNextCourtPlayers(pool, 4, state);
    expect(group?.map((p) => p.name)).toEqual(["A", "B", "C", "D"]);

    const nextPool = pool.filter((p) => !group?.some((g) => g.id === p.id));
    const lockedGroup = takeNextCourtPlayers(nextPool, 4, state);
    expect(lockedGroup?.map((p) => p.name)).toEqual(["E", "F", "G", "H"]);
  });

  it("CLEAR_TEAM_LOCK removes the group from all members", () => {
    let state = createInitialState();
    ["A", "B", "C", "D"].forEach((name) => {
      state = checkIn(state, name);
    });
    state = reduce(state, {
      type: "SET_TEAM_LOCK",
      playerIds: ["a", "b", "c", "d"],
    });
    state = reduce(state, { type: "CLEAR_TEAM_LOCK", playerId: "a" });

    expect(orderedWaitingPlayers(state).every((p) => !p.teamLockGroupId)).toBe(
      true,
    );
  });

  it("findSeparatedTeamLocks detects non-contiguous team locks", () => {
    let state = createInitialState();
    ["A", "B", "C", "D", "E", "F", "G", "H"].forEach((name) => {
      state = checkIn(state, name);
    });
    state = reduce(state, {
      type: "SET_TEAM_LOCK",
      playerIds: ["a", "b", "c", "d"],
    });
    state = reduce(state, {
      type: "REORDER_WAITING_QUEUE",
      playerIds: ["a", "e", "b", "f", "c", "g", "d", "h"],
    });

    const issues = findSeparatedTeamLocks(state);
    expect(issues).toHaveLength(1);
    expect(issues[0].names).toEqual(["A", "B", "C", "D"]);
  });

  it("findSeparatedTeamLocks returns empty when team lock is contiguous", () => {
    let state = createInitialState();
    ["A", "B", "C", "D", "E", "F", "G", "H"].forEach((name) => {
      state = checkIn(state, name);
    });
    state = reduce(state, {
      type: "SET_TEAM_LOCK",
      playerIds: ["a", "b", "c", "d"],
    });

    expect(findSeparatedTeamLocks(state)).toEqual([]);
  });

  it("formatSeparatedTeamLockMessage explains how to fix a split lock", () => {
    let state = createInitialState();
    ["A", "B", "C", "D", "E", "F", "G", "H"].forEach((name) => {
      state = checkIn(state, name);
    });
    state = reduce(state, {
      type: "SET_TEAM_LOCK",
      playerIds: ["a", "b", "c", "d"],
    });
    state = reduce(state, {
      type: "REORDER_WAITING_QUEUE",
      playerIds: ["a", "e", "b", "f", "c", "g", "d", "h"],
    });

    const issues = findSeparatedTeamLocks(state);
    const message = formatSeparatedTeamLockMessage(state, issues);
    expect(message).toContain("A · B · C · D");
    expect(message).toContain("grouped together");
  });

  it("getStackPushBlockReason blocks push when team lock is split", () => {
    let state = createInitialState();
    ["A", "B", "C", "D", "E", "F", "G", "H"].forEach((name) => {
      state = checkIn(state, name);
    });
    state = reduce(state, {
      type: "SET_TEAM_LOCK",
      playerIds: ["a", "b", "c", "d"],
    });
    state = reduce(state, {
      type: "REORDER_WAITING_QUEUE",
      playerIds: ["a", "e", "b", "f", "c", "g", "d", "h"],
    });

    const reason = getStackPushBlockReason(state);
    expect(reason).toContain("A · B · C · D");
    expect(reason).toContain("grouped together");
  });
});
