import { describe, expect, it } from "vitest";
import {
  createInitialState,
  type EngineMatch,
  type EnginePlayer,
} from "@/engine";
import {
  comebackDetail,
  formatRecord,
  raceHonors,
  sessionRace,
} from "@/lib/session-race";

function player(
  partial: Partial<EnginePlayer> & Pick<EnginePlayer, "id" | "name">,
): EnginePlayer {
  return {
    skill: "intermediate",
    status: "waiting",
    gamesPlayed: 0,
    lastPlayedAt: null,
    checkedInAt: 1,
    ...partial,
  };
}

function match(
  partial: Partial<EngineMatch> & Pick<EngineMatch, "id">,
): EngineMatch {
  return {
    courtId: "c1",
    courtName: "Court 1",
    teamA: [],
    teamB: [],
    status: "completed",
    winner: "a",
    startedAt: 1,
    endedAt: 1,
    ...partial,
  };
}

function raceFor(players: EnginePlayer[], matches: EngineMatch[]) {
  return sessionRace(createInitialState({ players, matches }));
}

describe("sessionRace", () => {
  it("stays quiet before anyone reports a winner", () => {
    const race = raceFor(
      [player({ id: "ana", name: "Ana", gamesPlayed: 1 })],
      [
        match({
          id: "returned",
          teamA: ["ana"],
          teamB: ["ben"],
          winner: null,
          endedAt: 5,
        }),
      ],
    );

    expect(race.bestLabel).toBeNull();
    expect(race.undefeated).toEqual([]);
    expect(race.comebacks).toEqual([]);
    expect(race.closest).toBeNull();
    expect(race.summary).toBe("No games decided yet · 1 player");
    expect(raceHonors(race)).toEqual([]);
  });

  it("ranks by wins, then win rate, then point difference", () => {
    const race = raceFor(
      [
        player({ id: "cara", name: "Cara", gamesPlayed: 5 }),
        player({ id: "ana", name: "Ana", gamesPlayed: 5 }),
        player({ id: "ben", name: "Ben", gamesPlayed: 6 }),
      ],
      [
        match({
          id: "m1",
          teamA: ["ana"],
          teamB: ["ben"],
          scoreA: 11,
          scoreB: 1,
          endedAt: 1,
        }),
        match({
          id: "m2",
          teamA: ["ana"],
          teamB: ["cara"],
          scoreA: 11,
          scoreB: 9,
          endedAt: 2,
        }),
        match({
          id: "m3",
          teamA: ["ben"],
          teamB: ["cara"],
          scoreA: 11,
          scoreB: 8,
          endedAt: 3,
        }),
        match({
          id: "m4",
          teamA: ["ana"],
          teamB: ["ben"],
          winner: "b",
          scoreA: 7,
          scoreB: 11,
          endedAt: 4,
        }),
        match({
          id: "m5",
          teamA: ["cara"],
          teamB: ["ben"],
          winner: "b",
          scoreA: 5,
          scoreB: 11,
          endedAt: 5,
        }),
      ],
    );

    expect(race.rows.map((row) => row.name)).toEqual(["Ben", "Ana", "Cara"]);
    expect(race.rows.map((row) => formatRecord(row.wins, row.losses))).toEqual([
      "3–1",
      "2–1",
      "0–3",
    ]);
    expect(race.bestLabel).toBe("Best player");
    expect(race.best.map((row) => row.name)).toEqual(["Ben"]);
    expect(race.rows[0].tag).toBe("Best");
    expect(race.rows[1].winRate).toBeCloseTo(2 / 3);
    expect(race.rows[0].pointDiff).toBe(3);
  });

  it("uses point difference only to split an equal record", () => {
    const race = raceFor(
      [player({ id: "ana", name: "Ana" }), player({ id: "ben", name: "Ben" })],
      [
        match({
          id: "wide",
          teamA: ["ana"],
          teamB: ["zoe"],
          scoreA: 11,
          scoreB: 1,
          endedAt: 1,
        }),
        match({
          id: "tight",
          teamA: ["ben"],
          teamB: ["zoe"],
          scoreA: 11,
          scoreB: 9,
          endedAt: 2,
        }),
      ],
    );

    expect(race.rows.map((row) => row.name)).toEqual(["Ana", "Ben"]);
    expect(race.bestLabel).toBe("Leading");
    expect(race.best.map((row) => row.name)).toEqual(["Ana"]);
    expect(race.ranks).toEqual([1, 2]);
  });

  it("calls one win the lead and two wins the best", () => {
    const leading = raceFor(
      [player({ id: "ana", name: "Ana" })],
      [match({ id: "m1", teamA: ["ana"], teamB: ["ben"], endedAt: 1 })],
    );
    expect(leading.bestLabel).toBe("Leading");
    expect(leading.rows[0].tag).toBe("Leading");
    expect(leading.undefeated).toEqual([]);

    const best = raceFor(
      [player({ id: "ana", name: "Ana" })],
      [
        match({ id: "m1", teamA: ["ana"], teamB: ["ben"], endedAt: 1 }),
        match({ id: "m2", teamA: ["ana"], teamB: ["cara"], endedAt: 2 }),
      ],
    );
    expect(best.bestLabel).toBe("Best player");
    expect(best.undefeated.map((row) => row.name)).toEqual(["Ana"]);
    expect(raceHonors(best).some((honor) => honor.id === "undefeated")).toBe(
      false,
    );
  });

  it("lists other unbeaten players when the leader has a loss", () => {
    const race = raceFor(
      [player({ id: "ana", name: "Ana" }), player({ id: "ben", name: "Ben" })],
      [
        match({ id: "m1", teamA: ["ana"], teamB: ["cara"], endedAt: 1 }),
        match({ id: "m2", teamA: ["ana"], teamB: ["dan"], endedAt: 2 }),
        match({ id: "m3", teamA: ["ana"], teamB: ["eve"], endedAt: 3 }),
        match({ id: "m4", teamA: ["ben"], teamB: ["ana"], endedAt: 4 }),
        match({ id: "m5", teamA: ["ben"], teamB: ["cara"], endedAt: 5 }),
      ],
    );

    expect(race.best.map((row) => row.name)).toEqual(["Ana"]);
    expect(formatRecord(race.rows[0].wins, race.rows[0].losses)).toBe("3–1");
    const honor = raceHonors(race).find((item) => item.id === "undefeated");
    expect(honor).toMatchObject({
      title: "No losses",
      body: "Ben",
      detail: "2–0",
    });
  });

  it("marks a comeback only after a player was behind or even", () => {
    const race = raceFor(
      [
        player({ id: "cara", name: "Cara" }),
        player({ id: "dan", name: "Dan" }),
        player({ id: "ana", name: "Ana" }),
      ],
      [
        match({ id: "cara-2", teamA: ["cara"], teamB: ["x"], endedAt: 2 }),
        match({ id: "cara-3", teamA: ["cara"], teamB: ["y"], endedAt: 3 }),
        match({
          id: "late-loss",
          teamA: ["cara"],
          teamB: ["x"],
          winner: "b",
          endedAt: 1,
        }),
        match({
          id: "dan-loss",
          teamA: ["dan"],
          teamB: ["x"],
          winner: "b",
          endedAt: 4,
        }),
        match({ id: "dan-1", teamA: ["dan"], teamB: ["y"], endedAt: 5 }),
        match({ id: "ana-1", teamA: ["ana"], teamB: ["x"], endedAt: 6 }),
        match({ id: "ana-2", teamA: ["ana"], teamB: ["y"], endedAt: 7 }),
        match({
          id: "ana-loss",
          teamA: ["ana"],
          teamB: ["z"],
          winner: "b",
          endedAt: 8,
        }),
      ],
    );

    const cara = race.rows.find((row) => row.name === "Cara");
    const dan = race.rows.find((row) => row.name === "Dan");
    const ana = race.rows.find((row) => row.name === "Ana");
    expect(comebackDetail(cara!)).toBe("Won 2 straight after falling to 0–1");
    expect(dan?.comeback).toBeNull();
    expect(ana?.comeback).toBeNull();
    expect(cara?.form).toEqual(["L", "W", "W"]);
    expect(cara?.streak).toBe(2);
    expect(race.comebacks.map((row) => row.name)).toEqual(["Cara"]);
    expect(raceHonors(race).find((honor) => honor.id === "comeback")).toEqual({
      id: "comeback",
      title: "Comeback",
      body: "Cara",
      detail: "Won 2 straight after falling to 0–1",
    });
  });

  it("treats a run from an even record as a comeback", () => {
    const race = raceFor(
      [player({ id: "ana", name: "Ana" })],
      [
        match({ id: "w", teamA: ["ana"], teamB: ["x"], endedAt: 1 }),
        match({
          id: "l",
          teamA: ["ana"],
          teamB: ["y"],
          winner: "b",
          endedAt: 2,
        }),
        match({ id: "w2", teamA: ["ana"], teamB: ["z"], endedAt: 3 }),
        match({ id: "w3", teamA: ["ana"], teamB: ["q"], endedAt: 4 }),
      ],
    );

    expect(comebackDetail(race.rows[0])).toBe(
      "Won 2 straight after sitting at 1–1",
    );
  });

  it("keeps a winner-less game out of the record", () => {
    const race = raceFor(
      [player({ id: "ana", name: "Ana", gamesPlayed: 2 })],
      [
        match({ id: "win", teamA: ["ana"], teamB: ["ben"], endedAt: 1 }),
        match({
          id: "void",
          teamA: ["ana"],
          teamB: ["cara"],
          winner: null,
          endedAt: 2,
        }),
      ],
    );

    expect(formatRecord(race.rows[0].wins, race.rows[0].losses)).toBe("1–0");
    expect(race.rows[0].gamesPlayed).toBe(2);
    expect(race.undefeated).toEqual([]);
  });

  it("picks the latest closest game and a wider one when scores differ", () => {
    const race = raceFor(
      [player({ id: "ana", name: "Ana" }), player({ id: "ben", name: "Ben" })],
      [
        match({
          id: "early-close",
          courtName: "Court 1",
          teamA: ["ana"],
          teamB: ["ben"],
          scoreA: 11,
          scoreB: 9,
          endedAt: 1,
        }),
        match({
          id: "blowout",
          courtName: "Court 2",
          teamA: ["ana"],
          teamB: ["ben"],
          scoreA: 11,
          scoreB: 2,
          endedAt: 2,
        }),
        match({
          id: "late-close",
          courtName: "Court 3",
          teamA: ["ben"],
          teamB: ["ana"],
          scoreA: 11,
          scoreB: 9,
          endedAt: 3,
        }),
      ],
    );

    expect(race.closest).toMatchObject({
      matchId: "late-close",
      scoreLabel: "11–9",
      courtName: "Court 3",
      winnerNames: ["Ben"],
    });
    expect(race.widest).toMatchObject({
      scoreLabel: "11–2",
      courtName: "Court 2",
    });
    const honors = raceHonors(race);
    expect(honors.find((honor) => honor.id === "closest")?.detail).toBe(
      "Ben over Ana · Court 3",
    );
    expect(honors.find((honor) => honor.id === "widest")?.body).toBe("11–2");
  });

  it("does not call the only scored game both closest and widest", () => {
    const race = raceFor(
      [player({ id: "ana", name: "Ana" })],
      [
        match({
          id: "only",
          teamA: ["ana"],
          teamB: ["ben"],
          scoreA: 11,
          scoreB: 4,
          endedAt: 1,
        }),
      ],
    );

    expect(race.closest?.scoreLabel).toBe("11–4");
    expect(race.widest).toBeNull();
  });

  it("names court time only when one player has clearly played more", () => {
    const quiet = raceFor(
      [
        player({ id: "ana", name: "Ana", gamesPlayed: 2 }),
        player({ id: "ben", name: "Ben", gamesPlayed: 1 }),
      ],
      [],
    );
    expect(quiet.mostGames).toEqual([]);

    const tied = raceFor(
      [
        player({ id: "ana", name: "Ana", gamesPlayed: 4 }),
        player({ id: "ben", name: "Ben", gamesPlayed: 4 }),
      ],
      [],
    );
    expect(tied.mostGames).toEqual([]);

    const race = raceFor(
      [
        player({ id: "ben", name: "Ben", gamesPlayed: 3 }),
        player({ id: "ana", name: "Ana", gamesPlayed: 5 }),
      ],
      [],
    );
    expect(raceHonors(race)).toEqual([
      {
        id: "most-games",
        title: "Most court time",
        body: "Ana",
        detail: "5 games",
      },
    ]);
  });

  it("shows who is still holding the court", () => {
    const race = raceFor(
      [
        player({
          id: "ana",
          name: "Ana",
          status: "playing",
          consecutiveWins: 2,
        }),
        player({
          id: "ben",
          name: "Ben",
          status: "waiting",
          consecutiveWins: 3,
        }),
      ],
      [match({ id: "m1", teamA: ["ana"], teamB: ["ben"], endedAt: 1 })],
    );

    expect(race.holding.map((row) => row.name)).toEqual(["Ana"]);
    expect(raceHonors(race).find((honor) => honor.id === "holding")).toEqual({
      id: "holding",
      title: "Holding the court",
      body: "Ana",
      detail: "2 straight wins, still on court",
    });
  });

  it("keeps a player who already left on the board", () => {
    const race = raceFor(
      [player({ id: "ana", name: "Ana", status: "left", gamesPlayed: 1 })],
      [match({ id: "m1", teamA: ["ana"], teamB: ["ben"], endedAt: 1 })],
    );

    expect(race.rows.map((row) => row.name)).toEqual(["Ana"]);
    expect(race.summary).toBe("1 game decided · 0 players");
  });

  it("gives both partners the same win", () => {
    const race = raceFor(
      [player({ id: "ana", name: "Ana" }), player({ id: "ben", name: "Ben" })],
      [
        match({
          id: "m1",
          teamA: ["ana", "ben"],
          teamB: ["cara", "dan"],
          endedAt: 1,
        }),
      ],
    );

    expect(race.bestLabel).toBe("Tied for the lead");
    expect(race.best.map((row) => row.tag)).toEqual(["Tied", "Tied"]);
    expect(raceHonors(race)[0]).toMatchObject({
      title: "Tied for the lead",
      body: "Ana & Ben",
      detail: "1–0 · 100%",
    });
  });
});
