import { describe, expect, it } from "vitest";
import {
  createdMatchIds,
  remapHostDispatch,
  renameNewMatches,
} from "./host-dispatch";

describe("renameNewMatches", () => {
  it("renames new matches to the client ids, in order", () => {
    const before = { matches: [{ id: "kept" }] };
    const after = {
      matches: [{ id: "kept" }, { id: "server-a" }, { id: "server-b" }],
    };

    expect(renameNewMatches(before, after, ["client-a", "client-b"])).toEqual({
      matches: [{ id: "kept" }, { id: "client-a" }, { id: "client-b" }],
    });
  });

  it("keeps the server matches when the client id count does not match", () => {
    const before = { matches: [] };
    const after = { matches: [{ id: "server-a" }] };

    expect(renameNewMatches(before, after, [])).toBe(after);
    expect(renameNewMatches(before, after, ["a", "b"])).toBe(after);
  });
});

describe("createdMatchIds", () => {
  it("returns ids that were not on the previous state", () => {
    expect(
      createdMatchIds(
        { matches: [{ id: "old" }] },
        { matches: [{ id: "old" }, { id: "new" }] },
      ),
    ).toEqual(["new"]);
  });
});

describe("remapHostDispatch", () => {
  const ids = new Map([
    ["p_sean", "player-uuid"],
    ["m_court", "match-uuid"],
  ]);

  it("rewrites a follow-up player action to the saved id", () => {
    expect(
      remapHostDispatch(
        { type: "SET_STATUS", playerId: "p_sean", status: "resting" },
        ids,
      ),
    ).toEqual({
      type: "SET_STATUS",
      playerId: "player-uuid",
      status: "resting",
    });
  });

  it("rewrites both sides of a partner lock and a queued match id", () => {
    expect(
      remapHostDispatch(
        {
          type: "SET_PARTNER_LOCK",
          playerId: "p_sean",
          partnerId: "already-saved",
        },
        ids,
      ),
    ).toEqual({
      type: "SET_PARTNER_LOCK",
      playerId: "player-uuid",
      partnerId: "already-saved",
    });

    expect(
      remapHostDispatch({ type: "START_MATCH", matchId: "m_court" }, ids),
    ).toEqual({ type: "START_MATCH", matchId: "match-uuid" });
  });

  it("leaves actions that already use saved ids unchanged", () => {
    const action = { type: "PUSH_TO_COURT" as const, courtId: "court-1" };
    expect(remapHostDispatch(action, ids)).toBe(action);
  });
});
