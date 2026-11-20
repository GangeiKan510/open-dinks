import type {
  EngineMatch,
  EnginePlayer,
  EngineState,
  PlayerStatus,
} from "@/engine";

/**
 * Session race for open play.
 *
 * Wins and losses come only from completed courts that named a winner.
 * A game sent back to the stack with no winner still counts as court time
 * (`gamesPlayed`) and does not change the record.
 *
 * Best is most wins, then win rate, then point difference. One win is the
 * lead, not the best of the night. No-loss players need two wins. A comeback
 * is two or more wins in a row that started when the player was behind or even.
 */

export type RaceResult = "W" | "L";

export type RaceTag =
  "Best" | "Tied" | "Leading" | "Comeback" | "No losses" | "Holding";

export type RaceComeback = {
  streak: number;
  winsBefore: number;
  lossesBefore: number;
};

export type PlayerRace = {
  playerId: string;
  name: string;
  status: PlayerStatus;
  gamesPlayed: number;
  wins: number;
  losses: number;
  decided: number;
  winRate: number | null;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  /** Oldest to newest, last five decided games. */
  form: RaceResult[];
  /** Positive is a win streak. Negative is a loss streak. */
  streak: number;
  comeback: RaceComeback | null;
  /** King-of-the-court wins while this player is still on court. */
  holdingWins: number;
  tag: RaceTag | null;
};

export type ScoredRaceGame = {
  matchId: string;
  courtName: string;
  scoreLabel: string;
  margin: number;
  winnerNames: string[];
  loserNames: string[];
};

export type RaceHonor = {
  id:
    | "best"
    | "undefeated"
    | "comeback"
    | "holding"
    | "closest"
    | "widest"
    | "most-games";
  title: string;
  body: string;
  detail: string;
};

export type SessionRace = {
  rows: PlayerRace[];
  /** Competition rank, parallel to `rows`. */
  ranks: number[];
  best: PlayerRace[];
  bestLabel:
    "Best player" | "Leading" | "Tied for best" | "Tied for the lead" | null;
  undefeated: PlayerRace[];
  comebacks: PlayerRace[];
  mostGames: PlayerRace[];
  holding: PlayerRace[];
  closest: ScoredRaceGame | null;
  widest: ScoredRaceGame | null;
  decidedGames: number;
  showPointDiff: boolean;
  summary: string;
};

const MIN_UNDEFEATED_WINS = 2;
const MIN_COMEBACK_STREAK = 2;
const MIN_HOLDING_WINS = 2;
const MIN_MOST_GAMES = 3;

export function formatRecord(wins: number, losses: number): string {
  return `${wins}\u2013${losses}`;
}

export function formatWinRate(rate: number | null): string {
  if (rate == null) return "\u2014";
  return `${Math.round(rate * 100)}%`;
}

export function formatPointDiff(diff: number): string {
  if (diff > 0) return `+${diff}`;
  if (diff < 0) return `\u2212${Math.abs(diff)}`;
  return "0";
}

export function formatStreakMark(streak: number): string {
  if (streak >= 1) return `W${streak}`;
  if (streak <= -1) return `L${Math.abs(streak)}`;
  return "\u2014";
}

export function formatRaceStatus(status: PlayerStatus): string | null {
  if (status === "playing") return "On court";
  if (status === "resting") return "Resting";
  if (status === "left") return "Left";
  return null;
}

export function formatNameList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

export function comebackPhrase(row: PlayerRace): string | null {
  if (!row.comeback) return null;
  const verb =
    row.comeback.winsBefore < row.comeback.lossesBefore
      ? "falling to"
      : "sitting at";
  return `${verb} ${formatRecord(row.comeback.winsBefore, row.comeback.lossesBefore)}`;
}

export function comebackDetail(row: PlayerRace): string {
  const phrase = comebackPhrase(row);
  if (!phrase || !row.comeback) return "";
  return `Won ${row.comeback.streak} straight after ${phrase}`;
}

export function raceRow(
  race: SessionRace,
  playerId: string,
): PlayerRace | null {
  return race.rows.find((row) => row.playerId === playerId) ?? null;
}

export function sessionRace(state: EngineState): SessionRace {
  const matches = decidedMatches(state);
  const names = new Map(
    state.players.map((player) => [player.id, player.name]),
  );
  const byId = new Map<string, MutableRace>();

  for (const player of state.players) {
    byId.set(player.id, emptyRace(player));
  }

  for (const match of matches) {
    const winners = new Set(match.winner === "a" ? match.teamA : match.teamB);
    const losers = new Set(
      (match.winner === "a" ? match.teamB : match.teamA).filter(
        (id) => !winners.has(id),
      ),
    );
    const sides = scoredSides(match);
    for (const id of winners) applyResult(byId, id, "W", sides, match.winner);
    for (const id of losers) applyResult(byId, id, "L", sides, match.winner);
  }

  const finished = [...byId.values()]
    .filter(
      (row) => row.status !== "left" || row.gamesPlayed > 0 || row.decided > 0,
    )
    .map(finishRace)
    .sort(compareRace);

  const leaders = leadingGroup(finished);
  const bestLabel = labelForBest(leaders);
  const bestIds = new Set(leaders.map((row) => row.playerId));
  const rows = finished.map((row) => ({
    ...row,
    tag: tagFor(row, bestIds, leaders.length),
  }));
  const best = rows.filter((row) => bestIds.has(row.playerId));
  const ranks = competitionRanks(rows);
  const undefeated = rows
    .filter((row) => row.wins >= MIN_UNDEFEATED_WINS && row.losses === 0)
    .sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));
  const comebacks = rows
    .filter((row) => row.comeback != null)
    .sort(
      (a, b) =>
        (b.comeback?.streak ?? 0) - (a.comeback?.streak ?? 0) ||
        b.wins - a.wins ||
        a.name.localeCompare(b.name),
    );
  const holding = rows
    .filter((row) => row.holdingWins >= MIN_HOLDING_WINS)
    .sort(
      (a, b) => b.holdingWins - a.holdingWins || a.name.localeCompare(b.name),
    );
  const scored = scoredGames(matches, names);
  const closest = pickClosest(scored);
  const widest = pickWidest(scored, closest);
  const mostGames = busiest(rows);
  const showPointDiff = scored.length > 0;
  const present = rows.filter((row) => row.status !== "left").length;

  return {
    rows,
    ranks,
    best,
    bestLabel,
    undefeated,
    comebacks,
    mostGames,
    holding,
    closest,
    widest,
    decidedGames: matches.length,
    showPointDiff,
    summary: raceSummary(matches.length, present),
  };
}

export function raceHonors(race: SessionRace): RaceHonor[] {
  const honors: RaceHonor[] = [];
  if (race.bestLabel && race.best.length > 0) {
    honors.push({
      id: "best",
      title: race.bestLabel,
      body: formatNameList(race.best.map((row) => row.name)),
      detail: bestDetail(race.best[0], race.showPointDiff),
    });
  }

  const bestIds = new Set(race.best.map((row) => row.playerId));
  const undefeatedIsBest =
    race.undefeated.length > 0 &&
    race.undefeated.length === race.best.length &&
    race.undefeated.every((row) => bestIds.has(row.playerId));
  if (race.undefeated.length > 0 && !undefeatedIsBest) {
    honors.push({
      id: "undefeated",
      title: "No losses",
      body: formatNameList(race.undefeated.map((row) => row.name)),
      detail:
        race.undefeated.length === 1
          ? formatRecord(race.undefeated[0].wins, 0)
          : race.undefeated
              .map((row) => `${row.name} ${formatRecord(row.wins, 0)}`)
              .join(" · "),
    });
  }

  if (race.comebacks.length === 1) {
    honors.push({
      id: "comeback",
      title: "Comeback",
      body: race.comebacks[0].name,
      detail: comebackDetail(race.comebacks[0]),
    });
  } else if (race.comebacks.length > 1) {
    honors.push({
      id: "comeback",
      title: "Comeback",
      body: formatNameList(race.comebacks.map((row) => row.name)),
      detail: race.comebacks
        .map((row) => `${row.name} ${comebackDetail(row).toLowerCase()}`)
        .join(". "),
    });
  }

  if (race.holding.length > 0) {
    const sameStreak = race.holding.every(
      (row) => row.holdingWins === race.holding[0].holdingWins,
    );
    honors.push({
      id: "holding",
      title: "Holding the court",
      body: formatNameList(race.holding.map((row) => row.name)),
      detail: sameStreak
        ? `${race.holding[0].holdingWins} straight wins, still on court`
        : `${race.holding
            .map((row) => `${row.name} ${row.holdingWins} straight`)
            .join(" · ")}, still on court`,
    });
  }

  if (race.closest) {
    honors.push({
      id: "closest",
      title: "Closest game",
      body: race.closest.scoreLabel,
      detail: `${formatNameList(race.closest.winnerNames)} over ${formatNameList(race.closest.loserNames)} · ${race.closest.courtName}`,
    });
  }

  if (race.widest) {
    honors.push({
      id: "widest",
      title: "Widest win",
      body: race.widest.scoreLabel,
      detail: `${formatNameList(race.widest.winnerNames)} over ${formatNameList(race.widest.loserNames)} · ${race.widest.courtName}`,
    });
  }

  if (race.mostGames.length > 0) {
    const games = race.mostGames[0].gamesPlayed;
    honors.push({
      id: "most-games",
      title: "Most court time",
      body: formatNameList(race.mostGames.map((row) => row.name)),
      detail:
        race.mostGames.length === 1 ? `${games} games` : `${games} games each`,
    });
  }

  return honors;
}

type MutableRace = Omit<PlayerRace, "winRate" | "form" | "streak" | "tag"> & {
  results: RaceResult[];
};

function emptyRace(player: EnginePlayer): MutableRace {
  return {
    playerId: player.id,
    name: player.name,
    status: player.status,
    gamesPlayed: player.gamesPlayed,
    wins: 0,
    losses: 0,
    decided: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    pointDiff: 0,
    comeback: null,
    holdingWins:
      player.status === "playing" &&
      (player.consecutiveWins ?? 0) >= MIN_HOLDING_WINS
        ? (player.consecutiveWins ?? 0)
        : 0,
    results: [],
  };
}

function finishRace(row: MutableRace): PlayerRace {
  const { results, ...rest } = row;
  const winRate = row.decided > 0 ? row.wins / row.decided : null;
  return {
    ...rest,
    winRate,
    form: results.slice(-5),
    streak: streakOf(results),
    comeback: comebackOf(results),
    tag: null,
  };
}

function decidedMatches(state: EngineState): EngineMatch[] {
  return state.matches
    .filter(
      (match) =>
        match.status === "completed" &&
        (match.winner === "a" || match.winner === "b"),
    )
    .slice()
    .sort(
      (a, b) => (a.endedAt ?? 0) - (b.endedAt ?? 0) || a.id.localeCompare(b.id),
    );
}

function scoredSides(match: EngineMatch): { a: number; b: number } | null {
  const a = match.scoreA;
  const b = match.scoreB;
  if (typeof a !== "number" || typeof b !== "number") return null;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { a, b };
}

function applyResult(
  byId: Map<string, MutableRace>,
  id: string,
  result: RaceResult,
  sides: { a: number; b: number } | null,
  winner: EngineMatch["winner"],
): void {
  const row = byId.get(id);
  if (!row) return;
  row.results.push(result);
  row.decided += 1;
  if (result === "W") row.wins += 1;
  else row.losses += 1;
  if (!sides || (winner !== "a" && winner !== "b")) return;
  const forWinner = winner === "a" ? sides.a : sides.b;
  const againstWinner = winner === "a" ? sides.b : sides.a;
  const pointsFor = result === "W" ? forWinner : againstWinner;
  const pointsAgainst = result === "W" ? againstWinner : forWinner;
  row.pointsFor += pointsFor;
  row.pointsAgainst += pointsAgainst;
  row.pointDiff = row.pointsFor - row.pointsAgainst;
}

function streakOf(results: RaceResult[]): number {
  if (results.length === 0) return 0;
  const last = results[results.length - 1];
  const sign = last === "W" ? 1 : -1;
  let count = 0;
  for (let i = results.length - 1; i >= 0; i -= 1) {
    if (results[i] !== last) break;
    count += 1;
  }
  return count * sign;
}

function comebackOf(results: RaceResult[]): RaceComeback | null {
  let streak = 0;
  for (let i = results.length - 1; i >= 0; i -= 1) {
    if (results[i] !== "W") break;
    streak += 1;
  }
  if (streak < MIN_COMEBACK_STREAK) return null;
  const before = results.slice(0, results.length - streak);
  if (!before.includes("L")) return null;
  const winsBefore = before.filter((result) => result === "W").length;
  const lossesBefore = before.length - winsBefore;
  if (winsBefore > lossesBefore) return null;
  return { streak, winsBefore, lossesBefore };
}

function compareRace(a: PlayerRace, b: PlayerRace): number {
  if (b.wins !== a.wins) return b.wins - a.wins;
  const aRate = a.winRate ?? -1;
  const bRate = b.winRate ?? -1;
  if (bRate !== aRate) return bRate - aRate;
  if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
  if (a.losses !== b.losses) return a.losses - b.losses;
  return a.name.localeCompare(b.name);
}

function samePlace(a: PlayerRace, b: PlayerRace): boolean {
  return (
    a.wins === b.wins &&
    a.winRate === b.winRate &&
    a.pointDiff === b.pointDiff &&
    a.losses === b.losses
  );
}

function competitionRanks(rows: PlayerRace[]): number[] {
  const ranks: number[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    if (i > 0 && samePlace(rows[i], rows[i - 1])) {
      ranks.push(ranks[i - 1]);
    } else {
      ranks.push(i + 1);
    }
  }
  return ranks;
}

function leadingGroup(rows: PlayerRace[]): PlayerRace[] {
  const first = rows.find((row) => row.wins > 0);
  if (!first) return [];
  return rows.filter((row) => samePlace(row, first));
}

function labelForBest(best: PlayerRace[]): SessionRace["bestLabel"] {
  if (best.length === 0) return null;
  const proven = best[0].wins >= MIN_UNDEFEATED_WINS;
  if (best.length === 1) return proven ? "Best player" : "Leading";
  return proven ? "Tied for best" : "Tied for the lead";
}

function tagFor(
  row: PlayerRace,
  bestIds: Set<string>,
  bestCount: number,
): RaceTag | null {
  const inBest = bestIds.has(row.playerId);
  if (inBest && row.wins >= MIN_UNDEFEATED_WINS && bestCount === 1) {
    return "Best";
  }
  if (inBest && row.wins >= MIN_UNDEFEATED_WINS && bestCount > 1) {
    return "Tied";
  }
  if (row.comeback) return "Comeback";
  if (row.wins >= MIN_UNDEFEATED_WINS && row.losses === 0) return "No losses";
  if (row.holdingWins >= MIN_HOLDING_WINS) return "Holding";
  if (inBest && row.wins === 1) return bestCount === 1 ? "Leading" : "Tied";
  return null;
}

function scoredGames(
  matches: EngineMatch[],
  names: Map<string, string>,
): ScoredRaceGame[] {
  const games: ScoredRaceGame[] = [];
  for (const match of matches) {
    const sides = scoredSides(match);
    if (!sides || (match.winner !== "a" && match.winner !== "b")) continue;
    const winnerIds = match.winner === "a" ? match.teamA : match.teamB;
    const loserIds = match.winner === "a" ? match.teamB : match.teamA;
    const winnerScore = match.winner === "a" ? sides.a : sides.b;
    const loserScore = match.winner === "a" ? sides.b : sides.a;
    games.push({
      matchId: match.id,
      courtName: match.courtName,
      scoreLabel: `${formatScore(winnerScore)}\u2013${formatScore(loserScore)}`,
      margin: Math.abs(winnerScore - loserScore),
      winnerNames: winnerIds.map((id) => names.get(id) ?? id),
      loserNames: loserIds.map((id) => names.get(id) ?? id),
    });
  }
  return games;
}

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : String(score);
}

function pickClosest(games: ScoredRaceGame[]): ScoredRaceGame | null {
  if (games.length === 0) return null;
  let best = games[0];
  for (const game of games) {
    if (game.margin <= best.margin) best = game;
  }
  return best;
}

function pickWidest(
  games: ScoredRaceGame[],
  closest: ScoredRaceGame | null,
): ScoredRaceGame | null {
  if (games.length < 2 || !closest) return null;
  let widest = games[0];
  for (const game of games) {
    if (game.margin >= widest.margin) widest = game;
  }
  if (widest.margin <= closest.margin) return null;
  return widest;
}

function busiest(rows: PlayerRace[]): PlayerRace[] {
  const played = rows.filter((row) => row.gamesPlayed > 0);
  if (played.length === 0) return [];
  const max = Math.max(...played.map((row) => row.gamesPlayed));
  if (max < MIN_MOST_GAMES) return [];
  const leaders = played.filter((row) => row.gamesPlayed === max);
  const someonePlayedLess = played.some((row) => row.gamesPlayed < max);
  if (!someonePlayedLess) return [];
  return leaders.sort((a, b) => a.name.localeCompare(b.name));
}

function bestDetail(row: PlayerRace, showPointDiff: boolean): string {
  const parts = [formatRecord(row.wins, row.losses)];
  if (row.winRate != null) parts.push(formatWinRate(row.winRate));
  const scored = row.pointsFor + row.pointsAgainst > 0;
  if (showPointDiff && scored) parts.push(formatPointDiff(row.pointDiff));
  return parts.join(" · ");
}

function raceSummary(decidedGames: number, present: number): string {
  const players = present === 1 ? "1 player" : `${present} players`;
  if (decidedGames === 0) return `No games decided yet · ${players}`;
  const games =
    decidedGames === 1 ? "1 game decided" : `${decidedGames} games decided`;
  return `${games} · ${players}`;
}
