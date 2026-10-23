import { describe, expect, it } from "vitest";
import { pairKey } from "@/lib/utils";
import {
  activeCategory,
  addCategory,
  addClub,
  addSponsor,
  addTeam,
  assignCourts,
  assignTeamBracket,
  assignTeamClub,
  autoAssignBrackets,
  bracketAssignmentIssue,
  bracketBlockReason,
  bracketChampion,
  clearMatchScore,
  clubStandings,
  commitCategory,
  createTournament,
  createTournamentEvent,
  discardBracket,
  generateBracket,
  generateGroups,
  groupStandings,
  isTournamentState,
  matchWinnerId,
  normalizeTournamentEvent,
  normalizeTournamentState,
  pointsToWin,
  bracketColumns,
  canUndoDraw,
  isThirdPlaceMatch,
  undoUnscoredDraw,
  upcomingMatches,
  removeCategory,
  removeClub,
  removeSponsor,
  setSponsorTier,
  reportMatchScore,
  resetDraw,
  setCategoryCourts,
  setDrawSettings,
  startOver,
  startOverEvent,
  umpireChooseSide,
  umpireClaimMatch,
  umpireFinishGame,
  umpirePoint,
  umpireReleaseMatch,
  umpireSetFirstServer,
  umpireSetServer,
  umpireSideout,
  umpireUndo,
  wildcardTeamIds,
  UMPIRE_CLAIM_STALE_MS,
  TournamentError,
  tournamentEventFromState,
  type KnockoutFill,
  type TournamentEvent,
  type TournamentMatch,
  type TournamentState,
  type TournamentTeam,
} from "./tournament";

function addNamed(
  state: TournamentState,
  names: Array<[string, string]>,
): TournamentState {
  return names.reduce((next, [a, b]) => addTeam(next, a, b), state);
}

function team(id: string, name: string): TournamentTeam {
  return {
    id,
    name,
    players: [name, "Partner"],
    bracketIndex: null,
    club: null,
  };
}

function scored(
  id: string,
  groupId: string,
  teamAId: string,
  teamBId: string,
  a: number,
  b: number,
): TournamentMatch {
  return {
    id,
    stage: "groups",
    groupId,
    round: 1,
    slot: 0,
    number: 1,
    courtNumber: null,
    teamAId,
    teamBId,
    games: [{ a, b }],
    status: "reported",
    nextMatchId: null,
    nextSlot: null,
  };
}

describe("tournament pools", () => {
  it("snakes 8 teams into two pools and schedules each pair once", () => {
    let state = createTournament({ courtCount: 4 });
    state = addNamed(state, [
      ["Smith", "Crozier"],
      ["Torres", "Doris"],
      ["Fernandez", "McDonald"],
      ["Murrieta", "Bierer"],
      ["Egure", "Carrell"],
      ["Dobson", "Tibbett"],
      ["Touzel", "Scotti"],
      ["Curley", "Yang"],
    ]);

    state = generateGroups(state);

    expect(state.phase).toBe("groups");
    expect(state.groups.map((group) => group.teamIds)).toEqual([
      ["team-1", "team-4", "team-5", "team-8"],
      ["team-2", "team-3", "team-6", "team-7"],
    ]);

    for (const group of state.groups) {
      const matches = state.matches.filter(
        (match) => match.groupId === group.id,
      );
      expect(matches).toHaveLength(6);
      const seen = new Set<string>();
      for (const match of matches) {
        expect(match.teamAId && match.teamBId).toBeTruthy();
        seen.add(pairKey(match.teamAId!, match.teamBId!));
      }
      expect(seen.size).toBe(6);
      const rounds = new Map<number, string[]>();
      for (const match of matches) {
        const ids = rounds.get(match.round) ?? [];
        ids.push(match.teamAId!, match.teamBId!);
        rounds.set(match.round, ids);
      }
      for (const ids of rounds.values()) {
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it("does not leave a pool of one team", () => {
    let state = setDrawSettings(createTournament(), {
      bracketCount: 3,
      teamsPerBracket: 4,
    });
    for (let index = 0; index < 9; index += 1) {
      state = addTeam(state, `A${index}`, `B${index}`);
    }
    state = generateGroups(state);
    expect(state.groups.every((group) => group.teamIds.length >= 2)).toBe(true);
    expect(
      state.groups.reduce((sum, group) => sum + group.teamIds.length, 0),
    ).toBe(9);
  });

  it("rejects a short draw, a blank name, and a duplicate team", () => {
    const state = addTeam(createTournament(), "Ada", "Bea");
    expect(() => generateGroups(state)).toThrow(TournamentError);
    expect(() => addTeam(state, " ", "Bea")).toThrow(/both player names/i);
    expect(() => addTeam(state, "ada", "bea")).toThrow(/already in the draw/i);
  });

  it("refuses more teams than the brackets can hold", () => {
    let state = setDrawSettings(createTournament(), {
      bracketCount: 2,
      teamsPerBracket: 3,
    });
    state = addNamed(state, [
      ["Ada", "Bea"],
      ["Cy", "Dee"],
      ["Eve", "Fay"],
      ["Gus", "Hal"],
      ["Ian", "Joy"],
      ["Ken", "Lea"],
      ["Max", "Ned"],
    ]);
    expect(() => generateGroups(state)).toThrow(/hold 6 teams/i);
  });

  it("asks for one score when the match is one game", () => {
    let state = setDrawSettings(createTournament(), {
      gamesPerMatch: 1,
      bracketCount: 1,
      teamsPerBracket: 2,
    });
    state = addNamed(state, [
      ["Ada", "Bea"],
      ["Cy", "Dee"],
    ]);
    state = generateGroups(state);
    expect(() =>
      reportMatchScore(state, state.matches[0].id, [
        { a: 11, b: 7 },
        { a: 11, b: 5 },
      ]),
    ).toThrow(/1 game/i);
    const next = reportMatchScore(state, state.matches[0].id, [
      { a: 11, b: 7 },
    ]);
    expect(next.matches[0].status).toBe("reported");
  });
});

describe("bracket assignment", () => {
  it("builds the brackets the director assigned", () => {
    let state = setDrawSettings(createTournament(), {
      bracketCount: 2,
      teamsPerBracket: 2,
    });
    state = addNamed(state, [
      ["Ada", "Bea"],
      ["Cy", "Dee"],
      ["Eve", "Fay"],
      ["Gus", "Hal"],
    ]);
    state = assignTeamBracket(state, "team-1", 0);
    state = assignTeamBracket(state, "team-2", 0);
    state = assignTeamBracket(state, "team-3", 1);
    state = assignTeamBracket(state, "team-4", 1);

    state = generateGroups(state);

    expect(state.groups.map((group) => group.name)).toEqual([
      "Bracket A",
      "Bracket B",
    ]);
    expect(state.groups.map((group) => group.teamIds)).toEqual([
      ["team-1", "team-2"],
      ["team-3", "team-4"],
    ]);
  });

  it("refuses a partial assignment, a short bracket, and an overfilled bracket", () => {
    let state = setDrawSettings(createTournament(), {
      bracketCount: 2,
      teamsPerBracket: 2,
    });
    state = addNamed(state, [
      ["Ada", "Bea"],
      ["Cy", "Dee"],
      ["Eve", "Fay"],
      ["Gus", "Hal"],
    ]);
    state = assignTeamBracket(state, "team-1", 0);
    expect(() => generateGroups(state)).toThrow(/assign every team/i);
    expect(bracketAssignmentIssue(state)).toMatch(/assign every team/i);

    state = assignTeamBracket(state, "team-2", 0);
    state = assignTeamBracket(state, "team-3", 0);
    state = assignTeamBracket(state, "team-4", 0);
    expect(() => generateGroups(state)).toThrow(/holds 2 teams/i);

    state = setDrawSettings(state, { teamsPerBracket: 4 });
    state = assignTeamBracket(state, "team-1", 0);
    state = assignTeamBracket(state, "team-2", 0);
    state = assignTeamBracket(state, "team-3", 0);
    state = assignTeamBracket(state, "team-4", 1);
    expect(bracketAssignmentIssue(state)).toMatch(/bracket b/i);
  });

  it("auto-fills the same snake an unassigned build would use", () => {
    let state = createTournament();
    state = addNamed(state, [
      ["Ada", "Bea"],
      ["Cy", "Dee"],
      ["Eve", "Fay"],
      ["Gus", "Hal"],
    ]);
    const filled = autoAssignBrackets(state);
    const built = generateGroups(filled);
    const snake = generateGroups(state);
    expect(built.groups.map((group) => group.teamIds)).toEqual(
      snake.groups.map((group) => group.teamIds),
    );
  });

  it("clears an assignment when that bracket is removed", () => {
    let state = setDrawSettings(createTournament(), { bracketCount: 2 });
    state = addTeam(state, "Ada", "Bea");
    state = assignTeamBracket(state, "team-1", 1);
    state = setDrawSettings(state, { bracketCount: 1 });
    expect(state.teams[0]?.bracketIndex).toBeNull();
  });

  it("keeps a saved team that has no bracket assignment yet", () => {
    const saved = {
      ...createTournament(),
      teams: [{ id: "team-1", name: "Ada / Bea", players: ["Ada", "Bea"] }],
    } as unknown as TournamentState;
    const next = normalizeTournamentState(saved);
    expect(next.teams[0]?.bracketIndex).toBeNull();
  });
});

describe("tournament standings", () => {
  it("records wins, points, and point differential", () => {
    const state: TournamentState = {
      ...createTournament(),
      phase: "groups",
      teams: [team("a", "Alpha"), team("b", "Bravo")],
      groups: [{ id: "g1", name: "Group A", teamIds: ["a", "b"] }],
      matches: [scored("m1", "g1", "a", "b", 11, 7)],
    };

    expect(groupStandings(state, "g1")).toEqual([
      expect.objectContaining({
        teamId: "a",
        wins: 1,
        losses: 0,
        pointsFor: 11,
        pointsAgainst: 7,
        diff: 4,
        rank: 1,
      }),
      expect.objectContaining({
        teamId: "b",
        wins: 0,
        losses: 1,
        pointsFor: 7,
        pointsAgainst: 11,
        diff: -4,
        rank: 2,
      }),
    ]);
  });

  it("lets head-to-head outrank point differential when two teams share a win total", () => {
    const teams = [
      team("a", "Alpha"),
      team("b", "Bravo"),
      team("c", "Charlie"),
      team("d", "Delta"),
    ];
    const state: TournamentState = {
      ...createTournament(),
      phase: "groups",
      teams,
      groups: [
        { id: "g1", name: "Group A", teamIds: teams.map((item) => item.id) },
      ],
      matches: [
        scored("m1", "g1", "a", "b", 11, 9),
        scored("m2", "g1", "a", "c", 11, 9),
        scored("m3", "g1", "a", "d", 0, 11),
        scored("m4", "g1", "b", "c", 11, 0),
        scored("m5", "g1", "b", "d", 11, 0),
      ],
    };

    expect(groupStandings(state, "g1").map((row) => row.teamId)).toEqual([
      "a",
      "b",
      "d",
      "c",
    ]);
  });

  it("uses point differential when more than two teams share a win total", () => {
    const teams = [
      team("a", "Alpha"),
      team("b", "Bravo"),
      team("c", "Charlie"),
    ];
    const state: TournamentState = {
      ...createTournament(),
      phase: "groups",
      teams,
      groups: [{ id: "g1", name: "Group A", teamIds: ["a", "b", "c"] }],
      matches: [
        scored("m1", "g1", "a", "b", 11, 9),
        scored("m2", "g1", "b", "c", 11, 0),
        scored("m3", "g1", "c", "a", 11, 9),
      ],
    };

    expect(groupStandings(state, "g1").map((row) => row.teamId)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("rejects a tied game and a match that is still split", () => {
    let state = addNamed(createTournament(), [
      ["Ada", "Bea"],
      ["Cy", "Dee"],
      ["Eve", "Fay"],
    ]);
    state = generateGroups(
      setDrawSettings(state, {
        bracketCount: 1,
        teamsPerBracket: 3,
        advancePerGroup: Math.max(state.advancePerGroup, 3),
      }),
    );
    const matchId = state.matches[0].id;
    expect(() => reportMatchScore(state, matchId, [{ a: 11, b: 11 }])).toThrow(
      /tie/i,
    );
    expect(() =>
      reportMatchScore(state, matchId, [
        { a: 11, b: 5 },
        { a: 5, b: 11 },
      ]),
    ).toThrow(/1 game/i);
  });
});

describe("tournament courts", () => {
  it("fills open courts with the next matches and will not double-book a team", () => {
    let state = createTournament({ courtCount: 2 });
    state = addNamed(state, [
      ["Smith", "Crozier"],
      ["Torres", "Doris"],
      ["Fernandez", "McDonald"],
      ["Murrieta", "Bierer"],
      ["Egure", "Carrell"],
      ["Dobson", "Tibbett"],
      ["Touzel", "Scotti"],
      ["Curley", "Yang"],
    ]);
    state = generateGroups(state);

    const onCourt = state.matches.filter((match) => match.courtNumber != null);
    expect(onCourt.map((match) => match.number)).toEqual([1, 2]);
    const busy = onCourt.flatMap((match) => [match.teamAId, match.teamBId]);
    expect(new Set(busy).size).toBe(busy.length);

    const reported = reportMatchScore(state, onCourt[0].id, [{ a: 11, b: 8 }]);
    expect(
      reported.matches.find((match) => match.id === onCourt[0].id)?.courtNumber,
    ).toBeNull();
    const stillOn = reported.matches.filter(
      (match) => match.courtNumber != null,
    );
    expect(stillOn).toHaveLength(2);
    expect(stillOn.some((match) => match.number === 3)).toBe(true);
  });

  it("keeps a team on one court when two of their matches are waiting", () => {
    const waiting = (
      id: string,
      teamAId: string,
      teamBId: string,
      number: number,
    ): TournamentMatch => ({
      id,
      stage: "groups",
      groupId: "g1",
      round: 1,
      slot: number,
      number,
      courtNumber: null,
      teamAId,
      teamBId,
      games: [],
      status: "unreported",
      nextMatchId: null,
      nextSlot: null,
    });
    const state: TournamentState = {
      ...createTournament({ courtCount: 2 }),
      phase: "groups",
      teams: [team("a", "Alpha"), team("b", "Bravo"), team("c", "Charlie")],
      groups: [{ id: "g1", name: "Group A", teamIds: ["a", "b", "c"] }],
      matches: [waiting("m1", "a", "b", 1), waiting("m2", "a", "c", 2)],
    };

    const next = assignCourts(state);
    expect(
      next.matches.filter((match) => match.courtNumber != null),
    ).toHaveLength(1);
    expect(next.matches[0].courtNumber).toBe(1);
    expect(next.matches[1].courtNumber).toBeNull();
  });

  it("queues the next matches whose teams are not already on court", () => {
    let state = createTournament({ courtCount: 2 });
    state = addNamed(state, [
      ["Smith", "Crozier"],
      ["Torres", "Doris"],
      ["Fernandez", "McDonald"],
      ["Murrieta", "Bierer"],
      ["Egure", "Carrell"],
      ["Dobson", "Tibbett"],
      ["Touzel", "Scotti"],
      ["Curley", "Yang"],
    ]);
    state = generateGroups(state);
    const event: TournamentEvent = {
      ...createTournamentEvent(),
      name: state.name,
      courtCount: state.courtCount,
      activeCategoryId: state.id,
      categories: [state],
    };

    const onCourt = state.matches.filter((match) => match.courtNumber != null);
    const playing = new Set(
      onCourt.flatMap((match) => [match.teamAId, match.teamBId]),
    );
    const next = upcomingMatches(event);

    expect(next).toHaveLength(2);
    expect(next.map((slot) => slot.match.number)).toEqual(
      [...next.map((slot) => slot.match.number)].sort((a, b) => a - b),
    );
    for (const slot of next) {
      expect(slot.match.courtNumber).toBeNull();
      expect(slot.match.status).toBe("unreported");
      expect(playing.has(slot.match.teamAId)).toBe(false);
      expect(playing.has(slot.match.teamBId)).toBe(false);
    }
  });
});

describe("tournament bracket", () => {
  it("waits until every pool match has a score", () => {
    let state = addNamed(createTournament(), [
      ["Ada", "Bea"],
      ["Cy", "Dee"],
      ["Eve", "Fay"],
    ]);
    state = generateGroups(
      setDrawSettings(state, {
        bracketCount: 1,
        teamsPerBracket: 3,
        advancePerGroup: Math.max(state.advancePerGroup, 3),
      }),
    );
    expect(bracketBlockReason(state)).toMatch(/finish every bracket match/i);
    expect(() => generateBracket(state)).toThrow(TournamentError);
  });

  it("advances a bye, then clears the final when the feeder winner flips", () => {
    let state = createTournament({ advancePerGroup: 3, courtCount: 2 });
    state = addNamed(state, [
      ["Ada", "Bea"],
      ["Cy", "Dee"],
      ["Eve", "Fay"],
    ]);
    state = generateGroups(
      setDrawSettings(state, {
        bracketCount: 1,
        teamsPerBracket: 3,
        advancePerGroup: Math.max(state.advancePerGroup, 3),
      }),
    );
    for (const match of state.matches) {
      state = reportMatchScore(state, match.id, [{ a: 11, b: 7 }]);
    }

    state = generateBracket(state);
    const bye = state.matches.find((match) => match.status === "bye");
    const playable = state.matches.find(
      (match) =>
        match.stage === "bracket" &&
        match.round === 1 &&
        match.status === "unreported",
    );
    const finalMatch = () =>
      state.matches.find(
        (match) => match.stage === "bracket" && match.round === 2,
      );
    const final = finalMatch();
    expect(bye && playable && final).toBeTruthy();
    expect([final!.teamAId, final!.teamBId]).toContain(matchWinnerId(bye!));
    expect(final!.teamAId == null || final!.teamBId == null).toBe(true);

    state = reportMatchScore(state, playable!.id, [{ a: 15, b: 5 }]);
    state = reportMatchScore(state, finalMatch()!.id, [{ a: 15, b: 8 }]);
    expect(bracketChampion(state)?.id).toBeTruthy();

    const flipped = playable!.teamBId;
    state = reportMatchScore(state, playable!.id, [{ a: 5, b: 15 }]);
    const finalAfter = finalMatch()!;
    expect(finalAfter.games).toEqual([]);
    expect(finalAfter.status).toBe("unreported");
    expect([finalAfter.teamAId, finalAfter.teamBId]).toContain(flipped);
    expect([finalAfter.teamAId, finalAfter.teamBId]).not.toContain(
      playable!.teamAId,
    );
    expect(bracketChampion(state)).toBeNull();
  });

  it("plays groups and quarters to 11, and semis and the final to 15", () => {
    const base = scored("group", "g1", "a", "b", 0, 0);
    const quarter = {
      ...base,
      id: "quarter",
      stage: "bracket" as const,
      round: 1,
      games: [],
      status: "unreported" as const,
    };
    const semi = { ...quarter, id: "semi", round: 2 };
    const final = { ...quarter, id: "final", round: 3 };
    let state: TournamentState = {
      ...createTournament(),
      phase: "bracket",
      teams: [team("a", "Alpha"), team("b", "Bravo")],
      matches: [quarter, semi, final],
    };
    expect(pointsToWin(state, quarter)).toBe(11);
    expect(pointsToWin(state, semi)).toBe(15);
    expect(pointsToWin(state, final)).toBe(15);
    expect(() => reportMatchScore(state, "quarter", [{ a: 10, b: 8 }])).toThrow(
      /played to 11/i,
    );
    expect(() => reportMatchScore(state, "semi", [{ a: 11, b: 9 }])).toThrow(
      /played to 15/i,
    );
    state = reportMatchScore(state, "quarter", [{ a: 11, b: 7 }]);
    state = reportMatchScore(state, "semi", [{ a: 15, b: 13 }]);
    expect(state.matches.find((match) => match.id === "semi")?.status).toBe(
      "reported",
    );

    const custom = setDrawSettings(createTournament(), {
      pointsToQuarters: 15,
      pointsSemisFinal: 21,
    });
    expect(custom.pointsToQuarters).toBe(15);
    expect(custom.pointsSemisFinal).toBe(21);
  });

  it("locks pool scores while a bracket exists and unlocks them when it is discarded", () => {
    let state = createTournament({ advancePerGroup: 3 });
    state = addNamed(state, [
      ["Ada", "Bea"],
      ["Cy", "Dee"],
      ["Eve", "Fay"],
    ]);
    state = generateGroups(
      setDrawSettings(state, {
        bracketCount: 1,
        teamsPerBracket: 3,
        advancePerGroup: Math.max(state.advancePerGroup, 3),
      }),
    );
    const poolId = state.matches[0].id;
    for (const match of [...state.matches]) {
      state = reportMatchScore(state, match.id, [{ a: 11, b: 7 }]);
    }
    state = generateBracket(state);
    expect(() => reportMatchScore(state, poolId, [{ a: 11, b: 3 }])).toThrow(
      /locked/i,
    );

    const pools = discardBracket(state);
    expect(pools.phase).toBe("groups");
    expect(pools.matches.every((match) => match.stage === "groups")).toBe(true);
    expect(pools.matches.every((match) => match.status === "reported")).toBe(
      true,
    );
    expect(resetDraw(pools).phase).toBe("setup");
    expect(resetDraw(pools).teams).toHaveLength(3);
    expect(resetDraw(pools).matches).toHaveLength(0);
  });

  it("undoes a draw only before a score is reported", () => {
    let state = setDrawSettings(createTournament(), {
      bracketCount: 1,
      teamsPerBracket: 2,
    });
    state = addNamed(state, [
      ["Ada", "Bea"],
      ["Cy", "Dee"],
    ]);
    state = generateGroups(state);
    expect(canUndoDraw(state)).toBe(true);

    const undone = undoUnscoredDraw(state);
    expect(undone.phase).toBe("setup");
    expect(undone.teams).toHaveLength(2);
    expect(undone.matches).toHaveLength(0);
    expect(undone.courtNumbers).toEqual(state.courtNumbers);

    state = generateGroups(undone);
    state = reportMatchScore(state, state.matches[0]!.id, [{ a: 11, b: 7 }]);
    expect(canUndoDraw(state)).toBe(false);
    expect(() => undoUnscoredDraw(state)).toThrow(/reported score/i);
  });

  it("undoes an unscored final and keeps the bracket scores", () => {
    let state = knockout(4);
    expect(canUndoDraw(state)).toBe(true);
    const pools = undoUnscoredDraw(state);
    expect(pools.phase).toBe("groups");
    expect(pools.matches.every((match) => match.status === "reported")).toBe(
      true,
    );

    state = generateBracket(pools);
    const playable = state.matches.find(
      (match) =>
        match.stage === "bracket" &&
        match.status === "unreported" &&
        match.teamAId &&
        match.teamBId,
    )!;
    state = reportMatchScore(state, playable.id, [{ a: 15, b: 8 }]);
    expect(canUndoDraw(state)).toBe(false);
    expect(() => undoUnscoredDraw(state)).toThrow(/reported score/i);
  });

  it("removes a bracket finalist when their semifinal score is cleared", () => {
    let state = createTournament({ advancePerGroup: 3 });
    state = addNamed(state, [
      ["Ada", "Bea"],
      ["Cy", "Dee"],
      ["Eve", "Fay"],
    ]);
    state = generateGroups(
      setDrawSettings(state, {
        bracketCount: 1,
        teamsPerBracket: 3,
        advancePerGroup: Math.max(state.advancePerGroup, 3),
      }),
    );
    for (const match of state.matches) {
      state = reportMatchScore(state, match.id, [{ a: 11, b: 7 }]);
    }
    state = generateBracket(state);
    const playable = state.matches.find(
      (match) =>
        match.stage === "bracket" &&
        match.round === 1 &&
        match.status === "unreported",
    )!;
    state = reportMatchScore(state, playable.id, [{ a: 15, b: 4 }]);
    const bracketFinal = (current: TournamentState) =>
      current.matches.find(
        (match) => match.stage === "bracket" && match.round === 2,
      )!;
    const finalWithBoth = bracketFinal(state);
    expect(finalWithBoth.teamAId && finalWithBoth.teamBId).toBeTruthy();

    state = clearMatchScore(state, playable.id);
    const finalAfter = bracketFinal(state);
    expect([finalAfter.teamAId, finalAfter.teamBId]).toContain(null);
  });

  it("plays semifinal losers for third and crowns the final winner", () => {
    let state = knockout(4);
    const semis = state.matches
      .filter((match) => match.stage === "bracket" && match.round === 1)
      .sort((a, b) => a.slot - b.slot);
    const final = () =>
      state.matches.find(
        (match) =>
          match.stage === "bracket" &&
          match.round === 2 &&
          !isThirdPlaceMatch(match),
      )!;
    const third = () => state.matches.find(isThirdPlaceMatch)!;

    expect(semis).toHaveLength(2);
    expect(third().teamAId).toBeNull();
    expect(pointsToWin(state, third())).toBe(state.pointsSemisFinal);
    expect(
      bracketColumns(state).map((column) =>
        column.groups.map((group) => group.label),
      ),
    ).toEqual([["Semifinals"], ["Final", "Third place"]]);

    state = reportMatchScore(state, semis[0]!.id, [{ a: 15, b: 8 }]);
    state = reportMatchScore(state, semis[1]!.id, [{ a: 15, b: 6 }]);
    expect([third().teamAId, third().teamBId].sort()).toEqual(
      [semis[0]!.teamBId, semis[1]!.teamBId].sort(),
    );
    expect([final().teamAId, final().teamBId].sort()).toEqual(
      [semis[0]!.teamAId, semis[1]!.teamAId].sort(),
    );
    expect(third().courtNumber).not.toBeNull();
    state = reportMatchScore(state, third().id, [{ a: 15, b: 10 }]);
    expect(third().status).toBe("reported");

    state = reportMatchScore(state, final().id, [{ a: 15, b: 12 }]);
    expect(bracketChampion(state)?.id).toBe(final().teamAId);
    expect(third().games).toEqual([{ a: 15, b: 10 }]);

    state = clearMatchScore(state, semis[0]!.id);
    expect(third().games).toEqual([]);
    expect(third().status).toBe("unreported");
    expect([third().teamAId, third().teamBId]).toContain(null);
    expect(bracketChampion(state)).toBeNull();
  });

  it("defaults open spots to byes and keeps that choice on a fresh start", () => {
    expect(createTournament().knockoutFill).toBe("bye");
    const saved = createTournament();
    delete (saved as { knockoutFill?: KnockoutFill }).knockoutFill;
    expect(normalizeTournamentState(saved).knockoutFill).toBe("bye");

    const chosen = setDrawSettings(createTournament(), {
      knockoutFill: "wildcard",
    });
    expect(chosen.knockoutFill).toBe("wildcard");
    expect(startOver(chosen).knockoutFill).toBe("wildcard");
    expect(normalizeTournamentState(chosen).knockoutFill).toBe("wildcard");
    expect(() =>
      setDrawSettings(createTournament(), {
        knockoutFill: "lucky" as KnockoutFill,
      }),
    ).toThrow(/byes or wild cards/i);
  });

  it("fills open quarterfinal spots with the best runners-up", () => {
    const pools = sixBracketPools("wildcard");
    expect(wildcardTeamIds(pools)).toEqual(["b2", "c2"]);

    const built = generateBracket(pools);
    expect(
      built.matches.some(
        (match) => match.stage === "bracket" && match.status === "bye",
      ),
    ).toBe(false);
    expect(roundOnePairs(built)).toEqual([
      ["a1", "c2"],
      ["b1", "e1"],
      ["b2", "f1"],
      ["c1", "d1"],
    ]);
  });

  it("leaves those spots empty when the draw uses byes", () => {
    const pools = sixBracketPools("bye");
    expect(wildcardTeamIds(pools)).toEqual([]);
    const built = generateBracket(pools);
    const byes = built.matches.filter((match) => match.status === "bye");
    expect(byes.map((match) => match.teamAId ?? match.teamBId).sort()).toEqual([
      "a1",
      "f1",
    ]);
    expect(
      built.matches.some(
        (match) =>
          match.stage === "bracket" &&
          (match.teamAId === "b2" || match.teamBId === "b2"),
      ),
    ).toBe(false);
  });

  it("does not add a wild card when the final is already full", () => {
    const pools: TournamentState = {
      ...createTournament(),
      phase: "groups",
      knockoutFill: "wildcard",
      advancePerGroup: 1,
      teams: [
        team("a1", "Alpha"),
        team("a2", "Able"),
        team("b1", "Baker"),
        team("b2", "Birch"),
      ],
      groups: [
        { id: "g1", name: "Bracket A", teamIds: ["a1", "a2"] },
        { id: "g2", name: "Bracket B", teamIds: ["b1", "b2"] },
      ],
      matches: [
        scored("m1", "g1", "a1", "a2", 11, 4),
        scored("m2", "g2", "b1", "b2", 11, 6),
      ],
    };
    expect(wildcardTeamIds(pools)).toEqual([]);
    const built = generateBracket(pools);
    expect(built.matches.some((match) => match.status === "bye")).toBe(false);
    const finalists = built.matches
      .filter((match) => match.stage === "bracket")
      .flatMap((match) => [match.teamAId, match.teamBId]);
    expect(finalists).toEqual(expect.arrayContaining(["a1", "b1"]));
    expect(finalists).not.toContain("a2");
  });

  it("ranks wild cards by wins before point differential", () => {
    const pools = winsBeforeDiffPools();
    expect(wildcardTeamIds(pools)).toEqual(["a2"]);
    const built = generateBracket(pools);
    expect(built.matches.some((match) => match.status === "bye")).toBe(false);
    expect(
      built.matches.some(
        (match) =>
          match.stage === "bracket" &&
          (match.teamAId === "b2" || match.teamBId === "b2"),
      ),
    ).toBe(false);
  });

  it("keeps a bye when a wild card cannot fill every open spot", () => {
    const pools: TournamentState = {
      ...createTournament(),
      phase: "groups",
      knockoutFill: "wildcard",
      advancePerGroup: 1,
      teams: [
        team("a", "Alpha"),
        team("b", "Bravo"),
        team("c", "Cedar"),
        team("d1", "Drew"),
        team("d2", "Dale"),
        team("e1", "Eden"),
        team("e2", "Echo"),
      ],
      groups: [
        { id: "g1", name: "Bracket A", teamIds: ["a"] },
        { id: "g2", name: "Bracket B", teamIds: ["b"] },
        { id: "g3", name: "Bracket C", teamIds: ["c"] },
        { id: "g4", name: "Bracket D", teamIds: ["d1", "d2"] },
        { id: "g5", name: "Bracket E", teamIds: ["e1", "e2"] },
      ],
      matches: [
        scored("m4", "g4", "d1", "d2", 11, 7),
        scored("m5", "g5", "e1", "e2", 11, 4),
      ],
    };
    expect(wildcardTeamIds(pools)).toEqual(["d2", "e2"]);
    const built = generateBracket(pools);
    expect(
      built.matches.filter(
        (match) => match.stage === "bracket" && match.status === "bye",
      ),
    ).toHaveLength(1);
    const bracketTeams = built.matches
      .filter((match) => match.stage === "bracket")
      .flatMap((match) => [match.teamAId, match.teamBId]);
    expect(bracketTeams).toEqual(expect.arrayContaining(["e2", "d2"]));
  });

  it("skips third place when a semifinal is a bye", () => {
    const state = knockout(3);
    expect(state.matches.some(isThirdPlaceMatch)).toBe(false);
    expect(
      bracketColumns(state).map((column) =>
        column.groups.map((group) => group.label),
      ),
    ).toEqual([["Semifinals"], ["Final"]]);
  });

  it("sends only semifinal losers to the third-place match", () => {
    const state = knockout(8);
    const quarters = state.matches.filter(
      (match) => match.stage === "bracket" && match.round === 1,
    );
    const semis = state.matches.filter(
      (match) => match.stage === "bracket" && match.round === 2,
    );
    expect(quarters).toHaveLength(4);
    expect(quarters.every((match) => !match.loserNextMatchId)).toBe(true);
    expect(
      semis.every((match) => match.loserNextMatchId === "bracket-third"),
    ).toBe(true);
    expect(
      bracketColumns(state).map((column) =>
        column.groups.map((group) => group.label),
      ),
    ).toEqual([["Quarterfinals"], ["Semifinals"], ["Final", "Third place"]]);
  });

  it("restores the third-place match when a saved bracket is loaded", () => {
    let state = knockout(4);
    const semis = state.matches.filter(
      (match) => match.stage === "bracket" && match.round === 1,
    );
    for (const semi of semis) {
      state = reportMatchScore(state, semi.id, [{ a: 15, b: 4 }]);
    }
    const final = state.matches.find(
      (match) =>
        match.stage === "bracket" &&
        match.round === 2 &&
        !isThirdPlaceMatch(match),
    )!;
    state = reportMatchScore(state, final.id, [{ a: 15, b: 9 }]);
    const scoredFinal = state.matches.find((match) => match.id === final.id)!;
    const championId = bracketChampion(state)?.id;
    const stripped: TournamentState = {
      ...state,
      matches: state.matches
        .filter((match) => !isThirdPlaceMatch(match))
        .map((match) => ({
          ...match,
          loserNextMatchId: null,
          loserNextSlot: null,
        })),
    };

    const loaded = normalizeTournamentState(stripped);
    const third = loaded.matches.find(isThirdPlaceMatch);
    expect(third?.teamAId && third.teamBId).toBeTruthy();
    expect(third?.status).toBe("unreported");
    expect(bracketChampion(loaded)?.id).toBe(championId);
    expect(
      loaded.matches.find((match) => match.id === scoredFinal.id)?.games,
    ).toEqual(scoredFinal.games);
  });
});

function roundOnePairs(state: TournamentState): string[][] {
  return state.matches
    .filter(
      (match) =>
        match.stage === "bracket" &&
        match.round === 1 &&
        match.teamAId &&
        match.teamBId,
    )
    .map((match) => [match.teamAId!, match.teamBId!].sort())
    .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
}

/** Six brackets of two. The two best losers are Birch (11–9) and Clay (11–8). */
function sixBracketPools(fill: KnockoutFill): TournamentState {
  const groups = [
    ["a1", "Alpha", "a2", "Able", 11, 0],
    ["b1", "Baker", "b2", "Birch", 11, 9],
    ["c1", "Cedar", "c2", "Clay", 11, 8],
    ["d1", "Drew", "d2", "Dale", 11, 5],
    ["e1", "Eden", "e2", "Echo", 11, 4],
    ["f1", "Fern", "f2", "Faye", 11, 1],
  ] as const;
  return {
    ...createTournament({ courtCount: 4 }),
    phase: "groups",
    knockoutFill: fill,
    advancePerGroup: 1,
    bracketCount: 6,
    teamsPerBracket: 2,
    teams: groups.flatMap(([winnerId, winner, loserId, loser]) => [
      team(winnerId, winner),
      team(loserId, loser),
    ]),
    groups: groups.map(([winnerId, , loserId], index) => ({
      id: `g${index}`,
      name: `Bracket ${index}`,
      teamIds: [winnerId, loserId],
    })),
    matches: groups.map(
      ([winnerId, , loserId, , winnerScore, loserScore], index) =>
        scored(
          `m${index}`,
          `g${index}`,
          winnerId,
          loserId,
          winnerScore,
          loserScore,
        ),
    ),
  };
}

/**
 * Three brackets. Able is second with 2 wins and +1.
 * Birch is second with 1 win and +9, so wins outrank differential.
 */
function winsBeforeDiffPools(): TournamentState {
  const teams: TournamentTeam[] = [
    team("a1", "Ace"),
    team("a2", "Able"),
    team("a3", "Ames"),
    team("a4", "Arch"),
    team("b1", "Bay"),
    team("b2", "Birch"),
    team("b3", "Bolt"),
    team("b4", "Bram"),
    team("c1", "Cay"),
    team("c2", "Clay"),
    team("c3", "Cobb"),
    team("c4", "Cruz"),
  ];
  const results: Array<[string, string, string, number, number]> = [
    ["ga", "a1", "a2", 11, 10],
    ["ga", "a1", "a3", 11, 0],
    ["ga", "a1", "a4", 11, 0],
    ["ga", "a2", "a3", 11, 10],
    ["ga", "a2", "a4", 11, 10],
    ["ga", "a3", "a4", 11, 0],
    ["gb", "b1", "b2", 11, 10],
    ["gb", "b1", "b3", 11, 0],
    ["gb", "b1", "b4", 11, 0],
    ["gb", "b2", "b3", 11, 0],
    ["gb", "b3", "b4", 11, 0],
    ["gb", "b4", "b2", 11, 10],
    ["gc", "c1", "c2", 11, 0],
    ["gc", "c1", "c3", 11, 0],
    ["gc", "c1", "c4", 11, 0],
    ["gc", "c2", "c3", 11, 9],
    ["gc", "c2", "c4", 11, 9],
    ["gc", "c3", "c4", 11, 9],
  ];
  return {
    ...createTournament({ courtCount: 4 }),
    phase: "groups",
    knockoutFill: "wildcard",
    advancePerGroup: 1,
    bracketCount: 3,
    teamsPerBracket: 4,
    teams,
    groups: [
      { id: "ga", name: "Bracket A", teamIds: ["a1", "a2", "a3", "a4"] },
      { id: "gb", name: "Bracket B", teamIds: ["b1", "b2", "b3", "b4"] },
      { id: "gc", name: "Bracket C", teamIds: ["c1", "c2", "c3", "c4"] },
    ],
    matches: results.map(([groupId, teamAId, teamBId, a, b], index) =>
      scored(`m${index}`, groupId, teamAId, teamBId, a, b),
    ),
  };
}

function knockout(teamCount: number): TournamentState {
  const roster: Array<[string, string]> = [
    ["Ada", "Bea"],
    ["Cy", "Dee"],
    ["Eve", "Fay"],
    ["Gus", "Hal"],
    ["Ivy", "Jo"],
    ["Kim", "Lee"],
    ["Mo", "Ned"],
    ["Ora", "Pia"],
  ];
  let state = addNamed(
    createTournament({ courtCount: 4 }),
    roster.slice(0, teamCount),
  );
  state = setDrawSettings(state, {
    bracketCount: 1,
    teamsPerBracket: teamCount,
    advancePerGroup: teamCount,
  });
  state = generateGroups(state);
  for (const match of state.matches) {
    state = reportMatchScore(state, match.id, [{ a: 11, b: 7 }]);
  }
  return generateBracket(state);
}

describe("umpire rally", () => {
  function started() {
    let state = setDrawSettings(createTournament({ courtCount: 1 }), {
      bracketCount: 1,
      teamsPerBracket: 2,
      gamesPerMatch: 1,
    });
    state = addNamed(state, [
      ["Ada", "Bea"],
      ["Cy", "Dee"],
    ]);
    state = generateGroups(state);
    return { state, matchId: state.matches[0]!.id };
  }

  it("scores only the serving team and rotates servers on a sideout", () => {
    const startedMatch = started();
    let state = startedMatch.state;
    const { matchId } = startedMatch;
    expect(() => umpirePoint(state, matchId)).toThrow(/serves first/i);

    state = umpireChooseSide(state, matchId, "a");
    expect(state.matches[0]?.live?.server).toBe(2);
    state = umpirePoint(state, matchId);
    expect(state.matches[0]?.live).toMatchObject({ scoreA: 1, scoreB: 0 });

    state = umpireSideout(state, matchId);
    expect(state.matches[0]?.live).toMatchObject({
      serving: "b",
      server: 1,
      scoreA: 1,
      scoreB: 0,
    });

    state = umpireSideout(state, matchId);
    expect(state.matches[0]?.live).toMatchObject({ serving: "b", server: 2 });

    state = umpireSetServer(state, matchId, 1);
    state = umpireSideout(state, matchId);
    expect(state.matches[0]?.live).toMatchObject({ serving: "b", server: 2 });

    state = umpireUndo(state, matchId);
    expect(state.matches[0]?.live).toMatchObject({ serving: "b", server: 1 });
  });

  it("saves a finished game and keeps a second game on the same match", () => {
    let state = setDrawSettings(createTournament({ courtCount: 1 }), {
      bracketCount: 1,
      teamsPerBracket: 2,
      gamesPerMatch: 2,
      pointsToQuarters: 1,
    });
    state = addNamed(state, [
      ["Ada", "Bea"],
      ["Cy", "Dee"],
    ]);
    state = generateGroups(state);
    const matchId = state.matches[0]!.id;
    state = umpireChooseSide(state, matchId, "a");
    state = umpirePoint(state, matchId);
    expect(() => umpireFinishGame(state, matchId)).not.toThrow();
    state = umpireFinishGame(state, matchId);
    expect(state.matches[0]?.status).toBe("unreported");
    expect(state.matches[0]?.games).toEqual([{ a: 1, b: 0 }]);
    expect(state.matches[0]?.live).toMatchObject({
      gameIndex: 1,
      scoreA: 0,
      scoreB: 0,
      serving: null,
      server: 2,
    });

    state = umpireChooseSide(state, matchId, "b");
    state = umpirePoint(state, matchId);
    state = umpirePoint(state, matchId);
    state = umpireFinishGame(state, matchId);
    expect(state.matches[0]?.status).toBe("reported");
    expect(state.matches[0]?.live).toBeNull();
  });

  it("keeps a court with the umpire who claimed it", () => {
    const startedMatch = started();
    let state = startedMatch.state;
    const { matchId } = startedMatch;
    const claimedAt = 1_000;
    state = umpireClaimMatch(state, matchId, "ump-a", claimedAt);
    expect(() => umpireClaimMatch(state, matchId, "ump-b", claimedAt)).toThrow(
      /another umpire/i,
    );
    expect(() => umpirePoint(state, matchId, "ump-b", claimedAt)).toThrow(
      /another umpire/i,
    );

    state = umpireChooseSide(state, matchId, "a", "ump-a", claimedAt);
    state = umpirePoint(state, matchId, "ump-a", claimedAt);
    expect(state.matches[0]?.live?.scoreA).toBe(1);
    expect(state.matches[0]?.claim?.umpireId).toBe("ump-a");

    const taken = umpireClaimMatch(
      state,
      matchId,
      "ump-b",
      claimedAt + UMPIRE_CLAIM_STALE_MS,
    );
    expect(taken.matches[0]?.claim?.umpireId).toBe("ump-b");

    state = umpireReleaseMatch(state, matchId, "ump-a");
    expect(state.matches[0]?.claim).toBeNull();
    state = umpireClaimMatch(state, matchId, "ump-b", claimedAt);
    expect(state.matches[0]?.claim?.umpireId).toBe("ump-b");
  });

  it("tags each team's first server and keeps it through a point", () => {
    const startedMatch = started();
    let state = startedMatch.state;
    const { matchId } = startedMatch;
    state = umpireSetFirstServer(state, matchId, "a", 0);
    state = umpireSetFirstServer(state, matchId, "b", 1);
    expect(state.matches[0]?.live).toMatchObject({
      firstServerA: 0,
      firstServerB: 1,
    });
    state = umpireChooseSide(state, matchId, "a");
    state = umpirePoint(state, matchId);
    state = umpireUndo(state, matchId);
    expect(state.matches[0]?.live).toMatchObject({
      scoreA: 0,
      firstServerA: 0,
      firstServerB: 1,
    });
    state = umpireClaimMatch(state, matchId, "ump-a", 1_000);
    expect(() =>
      umpireSetFirstServer(state, matchId, "a", 1, "ump-b", 1_000),
    ).toThrow(/another umpire/i);
  });
});

describe("club wins", () => {
  it("tallies reported match wins by club across categories", () => {
    let event = addClub(
      createTournamentEvent({ name: "HARAYA CUP" }),
      "Haraya",
    );
    event = addClub(event, "Dinks");
    const mens = {
      ...createTournament({ division: "Mens" }),
      id: "category-1",
      phase: "groups" as const,
      teams: [
        { ...team("a", "Alpha"), club: "Haraya" },
        { ...team("b", "Bravo"), club: "Dinks" },
        team("c", "Gamma"),
      ],
      matches: [
        scored("m1", "g1", "a", "b", 11, 5),
        {
          ...scored("bye", "g1", "a", "c", 0, 0),
          status: "bye" as const,
          games: [],
        },
        {
          ...scored("open", "g1", "b", "c", 11, 3),
          status: "unreported" as const,
        },
      ],
    };
    event = commitCategory(event, "category-1", mens);
    event = addCategory(event, "Womens");
    const womensId = event.categories[1]?.id ?? "";
    event = commitCategory(event, womensId, {
      ...createTournament({ division: "Womens" }),
      id: womensId,
      phase: "groups",
      teams: [
        { ...team("a", "Wynn"), club: "Haraya" },
        { ...team("b", "West"), club: "Dinks" },
      ],
      matches: [scored("w1", "g1", "a", "b", 11, 9)],
    });
    expect(clubStandings(event)).toEqual([
      { club: "Haraya", wins: 2, losses: 0 },
      { club: "Dinks", wins: 0, losses: 2 },
    ]);
  });

  it("keeps the list spelling and clears a club when it is removed", () => {
    let event = addClub(createTournamentEvent(), "Haraya");
    let state = addTeam(activeCategory(event), "Ada", "Bea");
    expect(() => assignTeamClub(state, "team-1", "Other", event.clubs)).toThrow(
      /club/i,
    );
    state = assignTeamClub(state, "team-1", "haraya", event.clubs);
    expect(state.teams[0]?.club).toBe("Haraya");
    event = commitCategory(event, state.id, state);
    event = removeClub(event, "Haraya");
    expect(event.clubs).toEqual([]);
    expect(event.categories[0]?.teams[0]?.club).toBeNull();
    expect(() => addClub(event, "  ")).toThrow(/club name/i);
  });

  it("rebuilds the club list from teams on an older save", () => {
    const saved = createTournamentEvent();
    const category = {
      ...saved.categories[0],
      teams: [{ ...team("a", "Alpha"), club: "Haraya" }],
    };
    const event = normalizeTournamentEvent({
      ...saved,
      clubs: undefined as unknown as string[],
      categories: [category],
    });
    expect(event.clubs).toEqual(["Haraya"]);
    expect(event.categories[0]?.teams[0]?.club).toBe("Haraya");
  });
});

describe("sponsor logos", () => {
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const logo = "https://example.com/logo.png";

  it("stores an https logo and drops an unsafe one", () => {
    let event = addSponsor(createTournamentEvent(), {
      id,
      name: "  Ace  ",
      url: logo,
      tier: "nickel",
    });
    expect(event.sponsors).toEqual([
      { id, name: "Ace", url: logo, tier: "nickel" },
    ]);
    expect(() =>
      addSponsor(event, { id, name: "Ace", url: logo, tier: "nickel" }),
    ).toThrow(/already/i);
    expect(() =>
      addSponsor(createTournamentEvent(), {
        id,
        name: "Ace",
        url: "http://example.com/logo.png",
        tier: "nickel",
      }),
    ).toThrow(/logo/i);
    event = removeSponsor(event, id);
    expect(event.sponsors).toEqual([]);

    const loaded = normalizeTournamentEvent({
      ...createTournamentEvent(),
      sponsors: [
        { id: "nope", name: "Bad", url: logo },
        { id, name: "Ace", url: logo },
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          name: "Http",
          url: "http://example.com/a.png",
        },
      ],
    } as unknown as TournamentEvent);
    expect(loaded.sponsors).toEqual([
      { id, name: "Ace", url: logo, tier: "nickel" },
    ]);
  });

  it("keeps platinum through nickel and maps the earlier levels", () => {
    const gold = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const silver = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    let event = addSponsor(createTournamentEvent(), {
      id,
      name: "Ace",
      url: logo,
      tier: "platinum",
    });
    expect(event.sponsors[0]?.tier).toBe("platinum");
    event = setSponsorTier(event, id, "gold");
    expect(event.sponsors[0]?.tier).toBe("gold");
    const loaded = normalizeTournamentEvent({
      ...createTournamentEvent(),
      sponsors: [
        { id, name: "Ace", url: logo, tier: "major" },
        { id: gold, name: "Bee", url: logo, tier: "minor" },
        { id: silver, name: "Cee", url: logo, tier: "standard" },
        {
          id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          name: "Dee",
          url: logo,
          tier: "headline",
        },
      ],
    } as unknown as TournamentEvent);
    expect(loaded.sponsors.map((sponsor) => sponsor.tier)).toEqual([
      "platinum",
      "gold",
      "nickel",
      "nickel",
    ]);
  });
});

describe("tournament categories", () => {
  it("keeps an older single-division save as the first category", () => {
    const saved = {
      name: "HARAYA CUP",
      division: "Mens Beginners",
      courtCount: 3,
      phase: "setup",
      teams: [
        { id: "team-1", name: "Jules / Sean", players: ["Jules", "Sean"] },
      ],
      groups: [],
      matches: [],
    };
    expect(isTournamentState(saved)).toBe(true);
    const event = normalizeTournamentEvent(
      tournamentEventFromState(saved as unknown as TournamentState),
    );
    expect(event.name).toBe("HARAYA CUP");
    expect(event.categories).toHaveLength(1);
    expect(event.categories[0]?.division).toBe("Mens Beginners");
    expect(event.categories[0]?.teams[0]?.bracketIndex).toBeNull();
    expect(event.categories[0]?.teams[0]?.club).toBeNull();
    expect(event.clubs).toEqual([]);
    expect(event.sponsors).toEqual([]);
    expect(event.categories[0]?.gamesPerMatch).toBe(1);
  });

  it("adds a second category without clearing the first", () => {
    let event = createTournamentEvent({ name: "HARAYA CUP" });
    const first = addTeam(activeCategory(event), "Jules", "Sean");
    event = commitCategory(event, first.id, first);
    event = addCategory(event, "Womens Open");

    expect(event.categories.map((category) => category.division)).toEqual([
      "Mixed 3.5",
      "Womens Open",
    ]);
    expect(event.categories[0]?.teams).toHaveLength(1);
    expect(activeCategory(event).teams).toHaveLength(0);
    expect(() => addCategory(event, "womens open")).toThrow(/already/i);
    expect(() => removeCategory(event, "missing")).toThrow(
      /not in this tournament/i,
    );
    expect(() =>
      removeCategory(
        { ...event, categories: [event.categories[0]] },
        event.categories[0].id,
      ),
    ).toThrow(/at least one/i);
  });

  it("shares courts when two categories are playing", () => {
    let event = createTournamentEvent({ courtCount: 2, name: "HARAYA CUP" });
    let mens = addNamed(activeCategory(event), [
      ["Smith", "Crozier"],
      ["Torres", "Doris"],
      ["Fernandez", "McDonald"],
      ["Murrieta", "Bierer"],
    ]);
    mens = generateGroups(
      setDrawSettings(mens, { bracketCount: 1, teamsPerBracket: 4 }),
    );
    event = commitCategory(event, mens.id, mens);

    event = addCategory(event, "Womens Open");
    let womens = addNamed(activeCategory(event), [
      ["Ann", "Bea"],
      ["Cia", "Dee"],
      ["Eve", "Fay"],
      ["Gia", "Hal"],
    ]);
    womens = generateGroups(
      setDrawSettings(womens, { bracketCount: 1, teamsPerBracket: 4 }),
    );
    event = commitCategory(event, womens.id, womens);

    const onCourt = event.categories.flatMap((category) =>
      category.matches.filter((match) => match.courtNumber != null),
    );
    expect(onCourt).toHaveLength(2);
    expect(new Set(onCourt.map((match) => match.courtNumber)).size).toBe(2);
    expect(
      event.categories.filter((category) =>
        category.matches.some((match) => match.courtNumber != null),
      ),
    ).toHaveLength(2);

    const mensMatch = event.categories[0]?.matches.find(
      (match) => match.courtNumber != null,
    );
    expect(mensMatch).toBeTruthy();
    const reported = commitCategory(
      event,
      event.categories[0].id,
      reportMatchScore(event.categories[0], mensMatch!.id, [{ a: 11, b: 7 }]),
    );
    expect(reported.categories[1]?.phase).toBe("groups");
    expect(reported.categories[1]?.matches.length).toBe(
      event.categories[1]?.matches.length,
    );
    expect(
      reported.categories[0]?.matches.find(
        (match) => match.id === mensMatch!.id,
      )?.status,
    ).toBe("reported");
  });

  it("keeps each category on the courts assigned to its venue", () => {
    let event = createTournamentEvent({ courtCount: 7, name: "HARAYA CUP" });
    let mens = addNamed(activeCategory(event), [
      ["Smith", "Crozier"],
      ["Torres", "Doris"],
      ["Fernandez", "McDonald"],
      ["Murrieta", "Bierer"],
    ]);
    mens = setCategoryCourts(
      generateGroups(
        setDrawSettings(mens, { bracketCount: 1, teamsPerBracket: 4 }),
      ),
      [1, 2, 3],
    );
    event = commitCategory(event, mens.id, mens);

    event = addCategory(event, "Womens Open");
    let womens = addNamed(activeCategory(event), [
      ["Ann", "Bea"],
      ["Cia", "Dee"],
      ["Eve", "Fay"],
      ["Gia", "Hal"],
    ]);
    womens = setCategoryCourts(
      generateGroups(
        setDrawSettings(womens, { bracketCount: 1, teamsPerBracket: 4 }),
      ),
      [4, 5, 6, 7],
    );
    event = commitCategory(event, womens.id, womens);

    const courtsFor = (division: string) =>
      event.categories
        .find((category) => category.division === division)
        ?.matches.map((match) => match.courtNumber)
        .filter((court): court is number => court != null) ?? [];
    expect(courtsFor("Mixed 3.5").every((court) => court <= 3)).toBe(true);
    expect(courtsFor("Womens Open").every((court) => court >= 4)).toBe(true);
    expect(courtsFor("Mixed 3.5").length).toBeGreaterThan(0);
    expect(courtsFor("Womens Open").length).toBeGreaterThan(0);
    expect(() => setCategoryCourts(mens, [])).toThrow(/at least one court/i);
  });

  it("clears every category and keeps their names", () => {
    let event = createTournamentEvent({ name: "HARAYA CUP" });
    const first = addTeam(activeCategory(event), "Jules", "Sean");
    event = commitCategory(event, first.id, first);
    event = addCategory(event, "Womens Open");
    const second = addTeam(activeCategory(event), "Ann", "Bea");
    event = commitCategory(event, second.id, second);

    const cleared = startOverEvent(event);
    expect(cleared.name).toBe("HARAYA CUP");
    expect(cleared.categories.map((category) => category.division)).toEqual([
      "Mixed 3.5",
      "Womens Open",
    ]);
    expect(
      cleared.categories.every((category) => category.teams.length === 0),
    ).toBe(true);
    expect(
      cleared.categories.every((category) => category.phase === "setup"),
    ).toBe(true);
  });
});
