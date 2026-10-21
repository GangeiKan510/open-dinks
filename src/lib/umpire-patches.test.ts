import { describe, expect, it } from "vitest";
import {
  createTournament,
  createTournamentEvent,
  type TournamentEvent,
  type TournamentMatch,
} from "@/engine/tournament";
import { isNewerTimestamp, matchFieldPatches } from "./umpire-patches";

function match(
  id: string,
  liveScore: number,
  courtNumber: number,
): TournamentMatch {
  return {
    id,
    stage: "groups",
    groupId: "g1",
    round: 1,
    slot: 0,
    number: 1,
    courtNumber,
    teamAId: "a",
    teamBId: "b",
    games: [],
    status: "unreported",
    nextMatchId: null,
    nextSlot: null,
    live: {
      gameIndex: 0,
      scoreA: liveScore,
      scoreB: 0,
      serving: "a",
      server: 2,
      past: [],
      firstServerA: 0,
      firstServerB: 0,
    },
    claim: { umpireId: "ump-1", claimedAt: 1 },
  };
}

function event(matches: TournamentMatch[]): TournamentEvent {
  return {
    ...createTournamentEvent(),
    categories: [
      {
        ...createTournament(),
        id: "category-1",
        phase: "groups",
        matches,
      },
    ],
  };
}

describe("umpire match patches", () => {
  it("sends a point on one court without the other court's score", () => {
    const before = event([match("court-1", 5, 1), match("court-2", 3, 2)]);
    const after = event([match("court-1", 6, 1), match("court-2", 3, 2)]);

    expect(matchFieldPatches(before, after)).toEqual([
      {
        categoryId: "category-1",
        matchId: "court-1",
        set: {
          live: expect.objectContaining({ scoreA: 6 }),
        },
      },
    ]);
  });

  it("touches only the claim when a court hold refreshes", () => {
    const before = event([match("court-1", 5, 1), match("court-2", 3, 2)]);
    const held = match("court-1", 5, 1);
    held.claim = { umpireId: "ump-1", claimedAt: 20 };
    const after = event([held, match("court-2", 3, 2)]);

    expect(matchFieldPatches(before, after)).toEqual([
      {
        categoryId: "category-1",
        matchId: "court-1",
        set: { claim: { umpireId: "ump-1", claimedAt: 20 } },
      },
    ]);
  });

  it("moves a court number without rewriting that match's score", () => {
    const before = event([match("court-1", 5, 1), match("court-2", 3, 2)]);
    const moved = match("court-2", 3, 4);
    const after = event([match("court-1", 5, 1), moved]);

    const patches = matchFieldPatches(before, after);
    expect(patches).toEqual([
      {
        categoryId: "category-1",
        matchId: "court-2",
        set: { courtNumber: 4 },
      },
    ]);
    expect(patches[0]?.set.live).toBeUndefined();
    expect(patches[0]?.set.games).toBeUndefined();
  });

  it("prefers the later tournament write", () => {
    expect(
      isNewerTimestamp("2026-10-21T02:00:02.000Z", "2026-10-21T02:00:01.000Z"),
    ).toBe(true);
    expect(
      isNewerTimestamp("2026-10-21T02:00:01.000Z", "2026-10-21T02:00:02.000Z"),
    ).toBe(false);
  });
});
