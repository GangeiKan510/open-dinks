import { normalizeCourtCount } from "@/lib/court-count";
import { pairKey } from "@/lib/utils";

export type TournamentPhase = "setup" | "groups" | "bracket";

export type TournamentMatchStatus = "unreported" | "reported" | "bye";

export interface TournamentTeam {
  id: string;
  name: string;
  players: [string, string];
  /** Round-robin bracket during setup. Null until the director assigns one. */
  bracketIndex: number | null;
  /** Club this team scores for. Null until the director assigns one. */
  club: string | null;
}

export interface GameScore {
  a: number;
  b: number;
}

export type RallySide = "a" | "b";

export interface RallySnapshot {
  scoreA: number;
  scoreB: number;
  serving: RallySide | null;
  server: 1 | 2;
}

/** Rally in progress. Doubles starts on the second server. */
export interface RallyLive extends RallySnapshot {
  gameIndex: number;
  past: RallySnapshot[];
  /** Which player on team A is that team's first server. */
  firstServerA: 0 | 1 | null;
  /** Which player on team B is that team's first server. */
  firstServerB: 0 | 1 | null;
}

export interface TournamentGroup {
  id: string;
  name: string;
  teamIds: string[];
}

export interface TournamentMatch {
  id: string;
  stage: "groups" | "bracket";
  groupId: string | null;
  round: number;
  slot: number;
  /** Stable label within the stage, shown as M1, M2, … */
  number: number;
  courtNumber: number | null;
  teamAId: string | null;
  teamBId: string | null;
  games: GameScore[];
  status: TournamentMatchStatus;
  nextMatchId: string | null;
  nextSlot: "a" | "b" | null;
  /** Semifinal losers feed the third-place match. */
  loserNextMatchId?: string | null;
  loserNextSlot?: "a" | "b" | null;
  /** Set on the match between the semifinal losers. */
  placement?: "third";
  /** Present while an umpire is calling the current game. */
  live?: RallyLive | null;
  /** Phone that currently has this court. Other umpires cannot take it. */
  claim?: UmpireClaim | null;
}

export interface UmpireClaim {
  umpireId: string;
  claimedAt: number;
}

/** A silent phone gives the court up after this long. */
export const UMPIRE_CLAIM_STALE_MS = 45_000;

export interface TournamentState {
  id: string;
  name: string;
  division: string;
  courtCount: number;
  /**
   * Courts this category may use. Empty means every court.
   * A venue split keeps one category on courts 1–3 and another on 4–7.
   */
  courtNumbers: number[];
  /** Score columns on each match. One game is a single box per team. */
  gamesPerMatch: number;
  /** Points a game is played to, from the groups through the quarterfinals. */
  pointsToQuarters: number;
  /** Points a game is played to in the semifinals, the final, and third place. */
  pointsSemisFinal: number;
  /** How many round-robin brackets to build. */
  bracketCount: number;
  /** How many teams sit in each round-robin bracket. */
  teamsPerBracket: number;
  /** How many teams leave each round-robin bracket for the final. */
  advancePerGroup: number;
  phase: TournamentPhase;
  teams: TournamentTeam[];
  groups: TournamentGroup[];
  matches: TournamentMatch[];
}

export interface StandingRow {
  rank: number;
  teamId: string;
  name: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
}

export interface CreateTournamentInput {
  name?: string;
  division?: string;
  courtCount?: number;
  gamesPerMatch?: number;
  pointsToQuarters?: number;
  pointsSemisFinal?: number;
  bracketCount?: number;
  teamsPerBracket?: number;
  advancePerGroup?: number;
}

export interface DrawSettings {
  gamesPerMatch?: number;
  pointsToQuarters?: number;
  pointsSemisFinal?: number;
  bracketCount?: number;
  teamsPerBracket?: number;
  advancePerGroup?: number;
}

/** One event, with categories that play at the same time and share the courts. */
export interface TournamentEvent {
  name: string;
  courtCount: number;
  activeCategoryId: string;
  categories: TournamentState[];
  /** Club names shared by every category. The scoreboard totals their wins. */
  clubs: string[];
  /** Logos shown on the public scoreboard. */
  sponsors: TournamentSponsor[];
}

export const SPONSOR_TIERS = [
  "platinum",
  "gold",
  "silver",
  "bronze",
  "nickel",
] as const;

export type SponsorTier = (typeof SPONSOR_TIERS)[number];

export interface TournamentSponsor {
  id: string;
  name: string;
  url: string;
  /** Platinum leads the scoreboard ticker. Nickel follows it. */
  tier: SponsorTier;
}

export const SPONSOR_TIER_LABELS: Record<SponsorTier, string> = {
  platinum: "Platinum",
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
  nickel: "Nickel",
};

export function isSponsorTier(value: string): value is SponsorTier {
  return (SPONSOR_TIERS as readonly string[]).includes(value);
}

export interface ClubStanding {
  club: string;
  wins: number;
  losses: number;
}

export class TournamentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TournamentError";
  }
}

const BYE = "__bye__";
const THIRD_PLACE_MATCH_ID = "bracket-third";
const MAX_TEAMS = 64;
const MAX_CATEGORIES = 8;
const MAX_NAME = 80;
const MAX_PLAYER = 40;
const MAX_CLUB = 40;
const MAX_CLUBS = 32;
export const MAX_SPONSOR_LOGOS = 80;
const MAX_SPONSOR_URL = 1024;
const SPONSOR_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SAMPLE_TEAMS: readonly (readonly [string, string])[] = [
  ["Smith", "Crozier"],
  ["Torres", "Doris"],
  ["Fernandez", "McDonald"],
  ["Murrieta", "Bierer"],
  ["Egure", "Carrell"],
  ["Dobson", "Tibbett"],
  ["Touzel", "Scotti"],
  ["Curley", "Yang"],
];

export function createTournament(
  input: CreateTournamentInput = {},
): TournamentState {
  return {
    id: "category-1",
    name: clip(input.name ?? "Saturday mixer", MAX_NAME),
    division: clip(input.division ?? "Mixed 3.5", MAX_NAME),
    courtCount: normalizeCourtCount(input.courtCount, 4),
    courtNumbers: [],
    gamesPerMatch: clampGames(input.gamesPerMatch ?? 1),
    pointsToQuarters: clampRallyPoints(input.pointsToQuarters, 11),
    pointsSemisFinal: clampRallyPoints(input.pointsSemisFinal, 15),
    bracketCount: clampBracketCount(input.bracketCount ?? 2),
    teamsPerBracket: clampTeamsPerBracket(input.teamsPerBracket ?? 4),
    advancePerGroup: clampAdvance(
      input.advancePerGroup ?? 2,
      input.teamsPerBracket ?? 4,
    ),
    phase: "setup",
    teams: [],
    groups: [],
    matches: [],
  };
}

export function isTournamentState(value: unknown): value is TournamentState {
  if (!value || typeof value !== "object") return false;
  const state = value as TournamentState;
  if (typeof state.name !== "string" || typeof state.division !== "string") {
    return false;
  }
  if (
    state.phase !== "setup" &&
    state.phase !== "groups" &&
    state.phase !== "bracket"
  ) {
    return false;
  }
  if (typeof state.courtCount !== "number") return false;
  if (
    state.advancePerGroup != null &&
    typeof state.advancePerGroup !== "number"
  ) {
    return false;
  }
  if (!Array.isArray(state.teams) || !state.teams.every(isTeam)) return false;
  if (!Array.isArray(state.groups) || !state.groups.every(isGroup))
    return false;
  if (!Array.isArray(state.matches) || !state.matches.every(isMatch)) {
    return false;
  }
  return true;
}

export function updateTournamentDetails(
  state: TournamentState,
  details: { name?: string; division?: string; courtCount?: number },
): TournamentState {
  const courtCount =
    details.courtCount === undefined
      ? state.courtCount
      : normalizeCourtCount(details.courtCount, state.courtCount);
  const next: TournamentState = {
    ...state,
    name:
      details.name === undefined ? state.name : clip(details.name, MAX_NAME),
    division:
      details.division === undefined
        ? state.division
        : clip(details.division, MAX_NAME),
    courtCount,
    courtNumbers: sanitizeCourtList(state.courtNumbers, courtCount),
  };
  if (next.phase === "setup") return next;
  return assignCourts(next);
}

/** Limits a category to these court numbers. Pass every court to clear the limit. */
export function setCategoryCourts(
  state: TournamentState,
  courtNumbers: number[],
): TournamentState {
  const unique = sanitizeCourtList(courtNumbers, state.courtCount);
  if (unique.length === 0) {
    throw new TournamentError("Keep at least one court for this category.");
  }
  const all = everyCourt(state.courtCount);
  return {
    ...state,
    courtNumbers: unique.length === all.length ? [] : unique,
  };
}

export function setDrawSettings(
  state: TournamentState,
  settings: DrawSettings,
): TournamentState {
  if (state.phase !== "setup") {
    throw new TournamentError("Reset the draw before changing the format.");
  }
  const teamsPerBracket =
    settings.teamsPerBracket === undefined
      ? state.teamsPerBracket
      : requireInt(
          settings.teamsPerBracket,
          2,
          8,
          "Each bracket holds 2 to 8 teams.",
        );
  const bracketCount =
    settings.bracketCount === undefined
      ? state.bracketCount
      : requireInt(settings.bracketCount, 1, 16, "Use 1 to 16 brackets.");
  const gamesPerMatch =
    settings.gamesPerMatch === undefined
      ? state.gamesPerMatch
      : requireInt(
          settings.gamesPerMatch,
          1,
          3,
          "A match is 1, 2, or 3 games.",
        );
  const pointsToQuarters =
    settings.pointsToQuarters === undefined
      ? state.pointsToQuarters
      : requireInt(settings.pointsToQuarters, 1, 99, "Play to 1 to 99 points.");
  const pointsSemisFinal =
    settings.pointsSemisFinal === undefined
      ? state.pointsSemisFinal
      : requireInt(settings.pointsSemisFinal, 1, 99, "Play to 1 to 99 points.");
  const advanceGiven = settings.advancePerGroup !== undefined;
  let advancePerGroup = advanceGiven
    ? requireInt(
        settings.advancePerGroup ?? 1,
        1,
        8,
        "Advance at least one team from each bracket.",
      )
    : state.advancePerGroup;
  if (advancePerGroup > teamsPerBracket) {
    if (advanceGiven) {
      throw new TournamentError(
        `Only ${teamsPerBracket} teams are in each bracket.`,
      );
    }
    advancePerGroup = teamsPerBracket;
  }
  return {
    ...state,
    gamesPerMatch,
    pointsToQuarters,
    pointsSemisFinal,
    bracketCount,
    teamsPerBracket,
    advancePerGroup,
    teams: state.teams.map((team) => ({
      ...team,
      bracketIndex: keptBracketIndex(team.bracketIndex, bracketCount),
    })),
  };
}

/** Fills format fields missing from an older saved draw. */
export function normalizeTournamentState(
  state: TournamentState,
): TournamentState {
  const teamsPerBracket = clampTeamsPerBracket(state.teamsPerBracket);
  const bracketCount = clampBracketCount(state.bracketCount);
  const normalized: TournamentState = {
    ...state,
    id:
      typeof state.id === "string" && state.id.trim()
        ? state.id.trim()
        : "category-1",
    courtCount: normalizeCourtCount(state.courtCount, 4),
    courtNumbers: sanitizeCourtList(
      state.courtNumbers,
      normalizeCourtCount(state.courtCount, 4),
    ),
    gamesPerMatch: clampGames(state.gamesPerMatch),
    pointsToQuarters: clampRallyPoints(state.pointsToQuarters, 11),
    pointsSemisFinal: clampRallyPoints(state.pointsSemisFinal, 15),
    bracketCount,
    teamsPerBracket,
    advancePerGroup: clampAdvance(state.advancePerGroup, teamsPerBracket),
    teams: state.teams.map((team) => ({
      ...team,
      bracketIndex: keptBracketIndex(team.bracketIndex, bracketCount),
      club: sanitizeClub(team.club),
    })),
    matches: state.matches.map((match) => ({
      ...match,
      live: sanitizeLive(match.live),
      claim: sanitizeClaim(match.claim),
    })),
  };
  if (normalized.phase !== "bracket") return normalized;
  return syncBracket(normalized);
}

export function addTeam(
  state: TournamentState,
  playerA: string,
  playerB: string,
): TournamentState {
  assertSetup(state);
  if (state.teams.length >= MAX_TEAMS) {
    throw new TournamentError("This draw already has 64 teams.");
  }
  const a = clip(playerA.trim(), MAX_PLAYER);
  const b = clip(playerB.trim(), MAX_PLAYER);
  if (!a || !b) throw new TournamentError("Enter both player names.");
  const name = `${a} / ${b}`;
  if (
    state.teams.some((team) => team.name.toLowerCase() === name.toLowerCase())
  ) {
    throw new TournamentError("That team is already in the draw.");
  }
  return {
    ...state,
    teams: [
      ...state.teams,
      {
        id: nextId(
          "team-",
          state.teams.map((team) => team.id),
        ),
        name,
        players: [a, b],
        bracketIndex: null,
        club: null,
      },
    ],
  };
}

export function assignTeamBracket(
  state: TournamentState,
  teamId: string,
  bracketIndex: number | null,
): TournamentState {
  assertSetup(state);
  if (!state.teams.some((team) => team.id === teamId)) {
    throw new TournamentError("That team is not in the draw.");
  }
  const nextIndex =
    bracketIndex === null
      ? null
      : requireInt(
          bracketIndex,
          0,
          Math.max(0, state.bracketCount - 1),
          "Pick a bracket on this draw.",
        );
  return {
    ...state,
    teams: state.teams.map((team) =>
      team.id === teamId ? { ...team, bracketIndex: nextIndex } : team,
    ),
  };
}

/** Snake the current team list into the bracket dropdowns. */
export function autoAssignBrackets(state: TournamentState): TournamentState {
  assertSetup(state);
  planBracketSizes(
    state.teams.length,
    state.bracketCount,
    state.teamsPerBracket,
  );
  const dealt = dealTeams(
    state.teams.map((team) => team.id),
    state.bracketCount,
  );
  const indexById = new Map<string, number>();
  dealt.forEach((ids, index) => {
    ids.forEach((id) => indexById.set(id, index));
  });
  return {
    ...state,
    teams: state.teams.map((team) => ({
      ...team,
      bracketIndex: indexById.get(team.id) ?? null,
    })),
  };
}

/** Tags a team with a club from the tournament list. Pass null to clear it. */
export function assignTeamClub(
  state: TournamentState,
  teamId: string,
  club: string | null,
  clubs: readonly string[],
): TournamentState {
  if (!state.teams.some((team) => team.id === teamId)) {
    throw new TournamentError("That team is not in the draw.");
  }
  const nextClub =
    club === null
      ? null
      : (clubs.find(
          (item) => item.toLowerCase() === club.trim().toLowerCase(),
        ) ?? null);
  if (club !== null && nextClub === null) {
    throw new TournamentError("Pick a club from the list.");
  }
  return {
    ...state,
    teams: state.teams.map((team) =>
      team.id === teamId ? { ...team, club: nextClub } : team,
    ),
  };
}

export function isSponsorLogoUrl(value: string): boolean {
  if (value.length > MAX_SPONSOR_URL) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function addSponsor(
  event: TournamentEvent,
  sponsor: TournamentSponsor,
): TournamentEvent {
  if (event.sponsors.length >= MAX_SPONSOR_LOGOS) {
    throw new TournamentError(
      `This tournament already has ${MAX_SPONSOR_LOGOS} sponsor logos.`,
    );
  }
  const next = sanitizeSponsor(sponsor);
  if (!next) throw new TournamentError("That logo could not be saved.");
  if (event.sponsors.some((item) => item.id === next.id)) {
    throw new TournamentError("That logo is already on this tournament.");
  }
  return { ...event, sponsors: [...event.sponsors, next] };
}

export function removeSponsor(
  event: TournamentEvent,
  sponsorId: string,
): TournamentEvent {
  if (!event.sponsors.some((item) => item.id === sponsorId)) {
    throw new TournamentError("That logo is not on this tournament.");
  }
  return {
    ...event,
    sponsors: event.sponsors.filter((item) => item.id !== sponsorId),
  };
}

export function setSponsorTier(
  event: TournamentEvent,
  sponsorId: string,
  tier: SponsorTier,
): TournamentEvent {
  if (!event.sponsors.some((item) => item.id === sponsorId)) {
    throw new TournamentError("That logo is not on this tournament.");
  }
  return {
    ...event,
    sponsors: event.sponsors.map((item) =>
      item.id === sponsorId
        ? { ...item, tier: sanitizeSponsorTier(tier) }
        : item,
    ),
  };
}

export function addClub(event: TournamentEvent, name: string): TournamentEvent {
  const club = clip(name.trim(), MAX_CLUB);
  if (!club) throw new TournamentError("Enter a club name.");
  if (event.clubs.some((item) => item.toLowerCase() === club.toLowerCase())) {
    throw new TournamentError("That club is already on this tournament.");
  }
  if (event.clubs.length >= MAX_CLUBS) {
    throw new TournamentError("This tournament already has 32 clubs.");
  }
  return { ...event, clubs: [...event.clubs, club] };
}

export function removeClub(
  event: TournamentEvent,
  name: string,
): TournamentEvent {
  const key = name.trim().toLowerCase();
  if (!event.clubs.some((item) => item.toLowerCase() === key)) {
    throw new TournamentError("That club is not on this tournament.");
  }
  return {
    ...event,
    clubs: event.clubs.filter((item) => item.toLowerCase() !== key),
    categories: event.categories.map((category) => ({
      ...category,
      teams: category.teams.map((team) =>
        team.club?.toLowerCase() === key ? { ...team, club: null } : team,
      ),
    })),
  };
}

/** Why a manual assignment cannot be built. Null when every team is unassigned. */
export function bracketAssignmentIssue(state: TournamentState): string | null {
  if (!state.teams.some((team) => team.bracketIndex != null)) return null;
  try {
    manualBracketGroups(state);
    return null;
  } catch (error) {
    return error instanceof TournamentError
      ? error.message
      : "Could not use those brackets.";
  }
}

export function removeTeam(
  state: TournamentState,
  teamId: string,
): TournamentState {
  assertSetup(state);
  return {
    ...state,
    teams: state.teams.filter((team) => team.id !== teamId),
  };
}

export function addSampleTeams(state: TournamentState): TournamentState {
  return SAMPLE_TEAMS.reduce(
    (next, pair) => addTeam(next, pair[0], pair[1]),
    state,
  );
}

export function generateGroups(state: TournamentState): TournamentState {
  assertSetup(state);
  if (state.teams.length < 2) {
    throw new TournamentError("Add at least 2 teams before building brackets.");
  }
  const dealt = state.teams.some((team) => team.bracketIndex != null)
    ? manualBracketGroups(state)
    : dealUnassigned(state);
  const groups: TournamentGroup[] = dealt.map((teamIds, index) => ({
    id: `group-${index + 1}`,
    name: bracketName(index),
    teamIds,
  }));

  const roundsByGroup = new Map(
    groups.map((group) => [group.id, roundRobinRounds(group.teamIds)]),
  );
  const maxRounds = Math.max(
    0,
    ...[...roundsByGroup.values()].map((rounds) => rounds.length),
  );

  const matches: TournamentMatch[] = [];
  let number = 1;
  for (let round = 0; round < maxRounds; round += 1) {
    for (const group of groups) {
      const pairs = roundsByGroup.get(group.id)?.[round] ?? [];
      pairs.forEach((pair, slot) => {
        matches.push({
          id: `pool-${group.id}-r${round + 1}-s${slot}`,
          stage: "groups",
          groupId: group.id,
          round: round + 1,
          slot,
          number: number++,
          courtNumber: null,
          teamAId: pair[0],
          teamBId: pair[1],
          games: [],
          status: "unreported",
          nextMatchId: null,
          nextSlot: null,
        });
      });
    }
  }

  return assignCourts({
    ...state,
    phase: "groups",
    groups,
    matches,
  });
}

export function reportMatchScore(
  state: TournamentState,
  matchId: string,
  games: GameScore[],
): TournamentState {
  const match = findMatch(state, matchId);
  if (match.stage === "groups" && state.phase === "bracket") {
    throw new TournamentError(
      "Bracket scores are locked once the final is built.",
    );
  }
  if (match.status === "bye") {
    throw new TournamentError("A bye does not need a score.");
  }
  if (thirdPlaceFollowsFinal(state, match)) {
    throw new TournamentError("Play the final before the third-place match.");
  }
  const clean = assertGames(
    games,
    match.teamAId,
    match.teamBId,
    state.gamesPerMatch,
    pointsToWin(state, match),
  );
  const matches = state.matches.map((item) =>
    item.id === matchId
      ? {
          ...item,
          games: clean,
          status: "reported" as const,
          courtNumber: null,
          live: null,
          claim: null,
        }
      : item,
  );
  return assignCourts(syncBracket({ ...state, matches }));
}

export function clearMatchScore(
  state: TournamentState,
  matchId: string,
): TournamentState {
  const match = findMatch(state, matchId);
  if (match.stage === "groups" && state.phase === "bracket") {
    throw new TournamentError(
      "Bracket scores are locked once the final is built.",
    );
  }
  if (match.status === "bye") {
    throw new TournamentError("A bye does not need a score.");
  }
  const matches = state.matches.map((item) =>
    item.id === matchId
      ? {
          ...item,
          games: [],
          status: "unreported" as const,
          courtNumber: null,
          live: null,
          claim: null,
        }
      : item,
  );
  return assignCourts(syncBracket({ ...state, matches }));
}

export function matchClaimHeldByOther(
  match: TournamentMatch,
  umpireId: string,
  now = Date.now(),
): boolean {
  const claim = sanitizeClaim(match.claim);
  if (!claim || claim.umpireId === umpireId) return false;
  return now - claim.claimedAt < UMPIRE_CLAIM_STALE_MS;
}

export function umpireClaimMatch(
  state: TournamentState,
  matchId: string,
  umpireId: string,
  now = Date.now(),
): TournamentState {
  const match = findMatch(state, matchId);
  assertCanOfficiate(state, match);
  if (matchClaimHeldByOther(match, umpireId, now)) {
    throw new TournamentError("Another umpire is calling this court.");
  }
  return writeClaim(state, matchId, { umpireId, claimedAt: now });
}

export function umpireReleaseMatch(
  state: TournamentState,
  matchId: string,
  umpireId: string,
): TournamentState {
  const match = findMatch(state, matchId);
  const claim = sanitizeClaim(match.claim);
  if (!claim || claim.umpireId !== umpireId) return state;
  return writeClaim(state, matchId, null);
}

export function umpireTouchClaim(
  state: TournamentState,
  matchId: string,
  umpireId: string,
  now = Date.now(),
): TournamentState {
  const match = findMatch(state, matchId);
  assertCanOfficiate(state, match);
  if (matchClaimHeldByOther(match, umpireId, now)) {
    throw new TournamentError("Another umpire is calling this court.");
  }
  return writeClaim(state, matchId, { umpireId, claimedAt: now });
}

function assertCanOfficiate(state: TournamentState, match: TournamentMatch) {
  if (match.stage === "groups" && state.phase === "bracket") {
    throw new TournamentError(
      "Bracket scores are locked once the final is built.",
    );
  }
  if (match.status === "bye") {
    throw new TournamentError("A bye does not need a score.");
  }
  if (match.status === "reported") {
    throw new TournamentError("That game is already reported.");
  }
  if (!match.teamAId || !match.teamBId) {
    throw new TournamentError("Both teams have to be on the court.");
  }
}

function freshLive(gameIndex: number): RallyLive {
  return {
    gameIndex,
    scoreA: 0,
    scoreB: 0,
    serving: null,
    server: 2,
    past: [],
    firstServerA: null,
    firstServerB: null,
  };
}

function ensureLive(match: TournamentMatch): RallyLive {
  const live = sanitizeLive(match.live);
  if (live && live.gameIndex === match.games.length) return live;
  return freshLive(match.games.length);
}

function remember(live: RallyLive): RallySnapshot[] {
  const past = [
    ...live.past,
    {
      scoreA: live.scoreA,
      scoreB: live.scoreB,
      serving: live.serving,
      server: live.server,
    },
  ];
  return past.length > 40 ? past.slice(past.length - 40) : past;
}

function writeLive(
  state: TournamentState,
  matchId: string,
  live: RallyLive,
): TournamentState {
  return {
    ...state,
    matches: state.matches.map((match) =>
      match.id === matchId ? { ...match, live } : match,
    ),
  };
}

/** The serving team for this rally. The game still starts on server 2. */
export function umpireChooseSide(
  state: TournamentState,
  matchId: string,
  side: RallySide,
  umpireId?: string,
  now = Date.now(),
): TournamentState {
  const match = findMatch(state, matchId);
  assertCanOfficiate(state, match);
  assertCaller(match, umpireId, now);
  const live = ensureLive(match);
  return writeLive(state, matchId, {
    ...live,
    past: remember(live),
    serving: side,
  });
}

/** Marks which of the two players is that team's first server for this game. */
export function umpireSetFirstServer(
  state: TournamentState,
  matchId: string,
  side: RallySide,
  playerIndex: 0 | 1,
  umpireId?: string,
  now = Date.now(),
): TournamentState {
  const match = findMatch(state, matchId);
  assertCanOfficiate(state, match);
  assertCaller(match, umpireId, now);
  if (playerIndex !== 0 && playerIndex !== 1) {
    throw new TournamentError("Pick one of the two players.");
  }
  const live = ensureLive(match);
  return writeLive(state, matchId, {
    ...live,
    ...(side === "a"
      ? { firstServerA: playerIndex }
      : { firstServerB: playerIndex }),
  });
}

export function umpireSetServer(
  state: TournamentState,
  matchId: string,
  server: 1 | 2,
  umpireId?: string,
  now = Date.now(),
): TournamentState {
  const match = findMatch(state, matchId);
  assertCanOfficiate(state, match);
  assertCaller(match, umpireId, now);
  const live = ensureLive(match);
  return writeLive(state, matchId, {
    ...live,
    past: remember(live),
    server,
  });
}

export function umpirePoint(
  state: TournamentState,
  matchId: string,
  umpireId?: string,
  now = Date.now(),
): TournamentState {
  const match = findMatch(state, matchId);
  assertCanOfficiate(state, match);
  assertCaller(match, umpireId, now);
  const live = ensureLive(match);
  if (!live.serving) {
    throw new TournamentError("Choose who serves first.");
  }
  const scoreA = live.serving === "a" ? live.scoreA + 1 : live.scoreA;
  const scoreB = live.serving === "b" ? live.scoreB + 1 : live.scoreB;
  if (scoreA > 99 || scoreB > 99) {
    throw new TournamentError("Game scores stop at 99.");
  }
  return writeLive(state, matchId, {
    ...live,
    past: remember(live),
    scoreA,
    scoreB,
  });
}

/**
 * Lost rally. Server 1 hands the serve to server 2 on the same team.
 * Server 2 hands it to the other team, who start on server 1.
 */
export function umpireSideout(
  state: TournamentState,
  matchId: string,
  umpireId?: string,
  now = Date.now(),
): TournamentState {
  const match = findMatch(state, matchId);
  assertCanOfficiate(state, match);
  assertCaller(match, umpireId, now);
  const live = ensureLive(match);
  if (!live.serving) {
    throw new TournamentError("Choose who serves first.");
  }
  if (live.server === 1) {
    return writeLive(state, matchId, {
      ...live,
      past: remember(live),
      server: 2,
    });
  }
  return writeLive(state, matchId, {
    ...live,
    past: remember(live),
    serving: live.serving === "a" ? "b" : "a",
    server: 1,
  });
}

export function umpireUndo(
  state: TournamentState,
  matchId: string,
  umpireId?: string,
  now = Date.now(),
): TournamentState {
  const match = findMatch(state, matchId);
  assertCanOfficiate(state, match);
  assertCaller(match, umpireId, now);
  const live = ensureLive(match);
  const previous = live.past[live.past.length - 1];
  if (!previous) throw new TournamentError("Nothing to undo.");
  return writeLive(state, matchId, {
    ...live,
    ...previous,
    past: live.past.slice(0, -1),
  });
}

export function umpireFinishGame(
  state: TournamentState,
  matchId: string,
  umpireId?: string,
  now = Date.now(),
): TournamentState {
  const match = findMatch(state, matchId);
  assertCanOfficiate(state, match);
  assertCaller(match, umpireId, now);
  const live = ensureLive(match);
  if (live.scoreA === live.scoreB) {
    throw new TournamentError("A game can't end in a tie.");
  }
  const target = pointsToWin(state, match);
  if (Math.max(live.scoreA, live.scoreB) < target) {
    throw new TournamentError(`This game is played to ${target}.`);
  }
  const games = [...match.games, { a: live.scoreA, b: live.scoreB }];
  if (games.length < state.gamesPerMatch) {
    return writeLive(
      {
        ...state,
        matches: state.matches.map((item) =>
          item.id === matchId ? { ...item, games } : item,
        ),
      },
      matchId,
      freshLive(games.length),
    );
  }
  return reportMatchScore(state, matchId, games);
}

export function bracketBlockReason(state: TournamentState): string | null {
  if (state.phase === "setup" || state.groups.length === 0) {
    return "Build the brackets before a final.";
  }
  if (state.phase === "bracket") return "The final bracket is already built.";
  const unfinished = state.matches.some(
    (match) => match.stage === "groups" && match.status !== "reported",
  );
  if (unfinished) {
    return "Finish every bracket match before building the final.";
  }
  if (advancingTeamIds(state).length < 2) {
    return "Need at least two teams to build a final.";
  }
  return null;
}

export function generateBracket(state: TournamentState): TournamentState {
  const reason = bracketBlockReason(state);
  if (reason) throw new TournamentError(reason);

  const seeded = advancingTeamIds(state);
  const size = nextPowerOfTwo(seeded.length);
  const positions = seedPositions(size);
  const rounds = Math.log2(size);
  const bracket: TournamentMatch[] = [];
  let number = 1;

  for (let round = 1; round <= rounds; round += 1) {
    const matchCount = size / 2 ** round;
    for (let slot = 0; slot < matchCount; slot += 1) {
      bracket.push({
        id: `bracket-r${round}-s${slot}`,
        stage: "bracket",
        groupId: null,
        round,
        slot,
        number: number++,
        courtNumber: null,
        teamAId: null,
        teamBId: null,
        games: [],
        status: "unreported",
        nextMatchId:
          round === rounds
            ? null
            : `bracket-r${round + 1}-s${Math.floor(slot / 2)}`,
        nextSlot: round === rounds ? null : slot % 2 === 0 ? "a" : "b",
      });
    }
  }

  const firstRound = size / 2;
  for (let slot = 0; slot < firstRound; slot += 1) {
    const match = bracket.find(
      (item) => item.round === 1 && item.slot === slot,
    );
    if (!match) continue;
    const seedA = positions[slot * 2];
    const seedB = positions[slot * 2 + 1];
    match.teamAId = seedA <= seeded.length ? seeded[seedA - 1] : null;
    match.teamBId = seedB <= seeded.length ? seeded[seedB - 1] : null;
    if (!match.teamAId || !match.teamBId) match.status = "bye";
  }

  const poolMatches = state.matches.filter((match) => match.stage === "groups");
  return assignCourts(
    syncBracket({
      ...state,
      phase: "bracket",
      matches: [...poolMatches, ...bracket],
    }),
  );
}

export function discardBracket(state: TournamentState): TournamentState {
  if (state.phase !== "bracket") return state;
  return assignCourts({
    ...state,
    phase: "groups",
    matches: state.matches
      .filter((match) => match.stage === "groups")
      .map((match) => ({ ...match, courtNumber: null })),
  });
}

export function resetDraw(state: TournamentState): TournamentState {
  return {
    ...state,
    phase: "setup",
    groups: [],
    matches: [],
  };
}

/** True while this stage has a draw and no saved score. */
export function canUndoDraw(state: TournamentState): boolean {
  if (state.phase !== "groups" && state.phase !== "bracket") return false;
  const stage = state.phase === "bracket" ? "bracket" : "groups";
  return !state.matches.some(
    (match) => match.stage === stage && match.status === "reported",
  );
}

/** Drops an unscored draw. A reported score stays put. */
export function undoUnscoredDraw(state: TournamentState): TournamentState {
  if (!canUndoDraw(state)) {
    throw new TournamentError(
      state.phase === "setup"
        ? "There is no draw to undo."
        : "A reported score has to stay.",
    );
  }
  if (state.phase === "bracket") return discardBracket(state);
  return resetDraw(state);
}

export function createTournamentEvent(
  input: CreateTournamentInput = {},
): TournamentEvent {
  const category = createTournament(input);
  return {
    name: category.name,
    courtCount: category.courtCount,
    activeCategoryId: category.id,
    categories: [category],
    clubs: [],
    sponsors: [],
  };
}

export function isTournamentEvent(value: unknown): value is TournamentEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as TournamentEvent;
  return (
    typeof event.name === "string" &&
    typeof event.courtCount === "number" &&
    typeof event.activeCategoryId === "string" &&
    Array.isArray(event.categories) &&
    event.categories.length > 0 &&
    event.categories.every(isTournamentState)
  );
}

export function activeCategory(event: TournamentEvent): TournamentState {
  const category =
    event.categories.find((item) => item.id === event.activeCategoryId) ??
    event.categories[0];
  if (!category) {
    throw new TournamentError("This tournament has no categories.");
  }
  return category;
}

/** Wraps a saved single-division draw as the first category. */
export function tournamentEventFromState(
  state: TournamentState,
): TournamentEvent {
  const category = normalizeTournamentState(state);
  return {
    name: category.name,
    courtCount: category.courtCount,
    activeCategoryId: category.id,
    categories: [category],
    clubs: sanitizeClubs(
      (state as TournamentState & { clubs?: unknown }).clubs,
    ),
    sponsors: sanitizeSponsors(
      (state as TournamentState & { sponsors?: unknown }).sponsors,
    ),
  };
}

export function normalizeTournamentEvent(
  event: TournamentEvent,
): TournamentEvent {
  const used = new Set<string>();
  const categories = event.categories.map((category) => {
    const normalized = normalizeTournamentState(category);
    let id = normalized.id;
    if (used.has(id)) {
      id = nextId("category-", [...used]);
    }
    used.add(id);
    return { ...normalized, id };
  });
  const clubs = clubsOnEvent(event.clubs, categories);
  const sponsors = sanitizeSponsors(event.sponsors);
  const courtCount = normalizeCourtCount(event.courtCount, 4);
  const name = clip(event.name, MAX_NAME);
  const activeCategoryId = categories.some(
    (category) => category.id === event.activeCategoryId,
  )
    ? event.activeCategoryId
    : categories[0].id;
  return assignEventCourts({
    name,
    courtCount,
    activeCategoryId,
    clubs,
    sponsors,
    categories: categories.map((category) => ({
      ...category,
      name,
      courtCount,
      teams: category.teams.map((team) => ({
        ...team,
        club: canonicalClub(team.club, clubs),
      })),
    })),
  });
}

export function selectCategory(
  event: TournamentEvent,
  categoryId: string,
): TournamentEvent {
  if (!event.categories.some((category) => category.id === categoryId)) {
    throw new TournamentError("That category is not in this tournament.");
  }
  return { ...event, activeCategoryId: categoryId };
}

export function addCategory(
  event: TournamentEvent,
  name: string,
): TournamentEvent {
  if (event.categories.length >= MAX_CATEGORIES) {
    throw new TournamentError("This tournament already has 8 categories.");
  }
  const division = clip(name.trim(), MAX_NAME);
  if (!division) throw new TournamentError("Enter a category name.");
  if (
    event.categories.some(
      (category) =>
        category.division.trim().toLowerCase() === division.toLowerCase(),
    )
  ) {
    throw new TournamentError("That category is already in this tournament.");
  }
  const id = nextId(
    "category-",
    event.categories.map((category) => category.id),
  );
  const created = createTournament({
    name: event.name,
    division,
    courtCount: event.courtCount,
  });
  return {
    ...event,
    activeCategoryId: id,
    categories: [...event.categories, { ...created, id }],
  };
}

export function removeCategory(
  event: TournamentEvent,
  categoryId: string,
): TournamentEvent {
  if (event.categories.length <= 1) {
    throw new TournamentError("Keep at least one category.");
  }
  const categories = event.categories.filter(
    (category) => category.id !== categoryId,
  );
  if (categories.length === event.categories.length) {
    throw new TournamentError("That category is not in this tournament.");
  }
  const activeCategoryId = categories.some(
    (category) => category.id === event.activeCategoryId,
  )
    ? event.activeCategoryId
    : categories[0].id;
  return assignEventCourts({ ...event, activeCategoryId, categories });
}

/** Writes one category back and reassigns the shared courts. */
export function commitCategory(
  event: TournamentEvent,
  categoryId: string,
  next: TournamentState,
): TournamentEvent {
  if (!event.categories.some((category) => category.id === categoryId)) {
    throw new TournamentError("That category is not in this tournament.");
  }
  const name = clip(next.name, MAX_NAME);
  const courtCount = normalizeCourtCount(next.courtCount, event.courtCount);
  return assignEventCourts({
    ...event,
    name,
    courtCount,
    categories: event.categories.map((category) => {
      if (category.id !== categoryId) return { ...category, name, courtCount };
      return { ...next, id: categoryId, name, courtCount };
    }),
  });
}

/** Keeps every category name and format, and clears teams and draws. */
export function startOverEvent(event: TournamentEvent): TournamentEvent {
  return {
    ...event,
    categories: event.categories.map((category) => ({
      ...createTournament({
        name: event.name,
        division: category.division,
        courtCount: event.courtCount,
        gamesPerMatch: category.gamesPerMatch,
        pointsToQuarters: category.pointsToQuarters,
        pointsSemisFinal: category.pointsSemisFinal,
        bracketCount: category.bracketCount,
        teamsPerBracket: category.teamsPerBracket,
        advancePerGroup: category.advancePerGroup,
      }),
      id: category.id,
    })),
  };
}

function everyCourt(courtCount: number): number[] {
  return Array.from({ length: courtCount }, (_, index) => index + 1);
}

function sanitizeCourtList(value: unknown, courtCount: number): number[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  for (const item of value) {
    if (!Number.isInteger(item) || item < 1 || item > courtCount) continue;
    seen.add(item);
  }
  return [...seen].sort((a, b) => a - b);
}

function courtsForCategory(category: TournamentState): number[] {
  const listed = sanitizeCourtList(category.courtNumbers, category.courtCount);
  return listed.length === 0 ? everyCourt(category.courtCount) : listed;
}

function courtsInUse(category: TournamentState): number {
  return category.matches.filter((match) => match.courtNumber != null).length;
}

function categoryHasReadyMatch(category: TournamentState): boolean {
  if (category.phase === "setup") return false;
  const stage = category.phase === "bracket" ? "bracket" : "groups";
  return category.matches.some(
    (match) =>
      match.stage === stage &&
      match.status === "unreported" &&
      match.teamAId &&
      match.teamBId &&
      !thirdPlaceFollowsFinal(category, match),
  );
}

/**
 * One court list for every category that is already playing.
 * A team stays on at most one court inside their own category.
 */
export function assignEventCourts(event: TournamentEvent): TournamentEvent {
  const prepared = event.categories.map((category) => {
    const stage = category.phase === "bracket" ? "bracket" : "groups";
    return {
      ...category,
      name: event.name,
      courtCount: event.courtCount,
      courtNumbers: sanitizeCourtList(category.courtNumbers, event.courtCount),
      matches: cloneMatches(category.matches).map((match) => {
        if (category.phase === "setup" || match.stage !== stage) {
          return { ...match, courtNumber: null };
        }
        if (
          match.status === "reported" ||
          match.status === "bye" ||
          thirdPlaceFollowsFinal(category, match)
        ) {
          return { ...match, courtNumber: null };
        }
        const allowed = courtsForCategory({
          ...category,
          courtCount: event.courtCount,
        });
        if (
          match.courtNumber != null &&
          (match.courtNumber > event.courtCount ||
            match.courtNumber < 1 ||
            !allowed.includes(match.courtNumber) ||
            !match.teamAId ||
            !match.teamBId)
        ) {
          return { ...match, courtNumber: null };
        }
        return match;
      }),
    };
  });

  const occupied = new Set<number>();
  const busy = new Set<string>();
  for (const category of prepared) {
    if (category.phase === "setup") continue;
    const stage = category.phase === "bracket" ? "bracket" : "groups";
    for (const match of category.matches) {
      if (match.stage !== stage || match.status !== "unreported") continue;
      if (match.courtNumber == null || !match.teamAId || !match.teamBId) {
        continue;
      }
      const teamA = `${category.id}:${match.teamAId}`;
      const teamB = `${category.id}:${match.teamBId}`;
      if (
        occupied.has(match.courtNumber) ||
        busy.has(teamA) ||
        busy.has(teamB)
      ) {
        match.courtNumber = null;
        continue;
      }
      occupied.add(match.courtNumber);
      busy.add(teamA);
      busy.add(teamB);
    }
  }

  // A category that is ready to play should not sit at zero courts
  // while another category is using more than one.
  for (let guard = 0; guard < event.courtCount; guard += 1) {
    const needy = prepared.filter(
      (category) =>
        categoryHasReadyMatch(category) && courtsInUse(category) === 0,
    );
    if (needy.length === 0) break;
    const needed = new Set(
      needy.flatMap((category) => courtsForCategory(category)),
    );
    const donor = prepared
      .filter(
        (category) =>
          courtsInUse(category) > 1 &&
          category.matches.some(
            (match) =>
              match.courtNumber != null && needed.has(match.courtNumber),
          ),
      )
      .sort((a, b) => courtsInUse(b) - courtsInUse(a))[0];
    if (!donor) break;
    const released = donor.matches
      .filter(
        (match) => match.courtNumber != null && needed.has(match.courtNumber),
      )
      .sort(
        (a, b) =>
          b.number - a.number || (b.courtNumber ?? 0) - (a.courtNumber ?? 0),
      )[0];
    if (
      !released?.teamAId ||
      !released.teamBId ||
      released.courtNumber == null
    ) {
      break;
    }
    occupied.delete(released.courtNumber);
    busy.delete(`${donor.id}:${released.teamAId}`);
    busy.delete(`${donor.id}:${released.teamBId}`);
    released.courtNumber = null;
  }

  const waiting: Array<{ category: TournamentState; match: TournamentMatch }> =
    [];
  for (const category of prepared) {
    if (category.phase === "setup") continue;
    const stage = category.phase === "bracket" ? "bracket" : "groups";
    for (const match of category.matches) {
      if (
        match.stage === stage &&
        match.status === "unreported" &&
        match.courtNumber == null &&
        match.teamAId &&
        match.teamBId &&
        !thirdPlaceFollowsFinal(category, match)
      ) {
        waiting.push({ category, match });
      }
    }
  }
  waiting.sort(
    (a, b) =>
      a.match.round - b.match.round ||
      a.match.number - b.match.number ||
      a.category.id.localeCompare(b.category.id),
  );

  for (const slot of waiting) {
    if (!slot.match.teamAId || !slot.match.teamBId) continue;
    const teamA = `${slot.category.id}:${slot.match.teamAId}`;
    const teamB = `${slot.category.id}:${slot.match.teamBId}`;
    if (busy.has(teamA) || busy.has(teamB)) continue;
    const allowed = new Set(courtsForCategory(slot.category));
    let court: number | null = null;
    for (let number = 1; number <= event.courtCount; number += 1) {
      if (allowed.has(number) && !occupied.has(number)) {
        court = number;
        break;
      }
    }
    if (court == null) continue;
    slot.match.courtNumber = court;
    occupied.add(court);
    busy.add(teamA);
    busy.add(teamB);
  }

  return { ...event, categories: prepared };
}

/** Keeps the event name and settings, clears teams and the draw. */
export function startOver(state: TournamentState): TournamentState {
  return createTournament({
    name: state.name,
    division: state.division,
    courtCount: state.courtCount,
    gamesPerMatch: state.gamesPerMatch,
    pointsToQuarters: state.pointsToQuarters,
    pointsSemisFinal: state.pointsSemisFinal,
    bracketCount: state.bracketCount,
    teamsPerBracket: state.teamsPerBracket,
    advancePerGroup: state.advancePerGroup,
  });
}

export function assignCourts(state: TournamentState): TournamentState {
  if (state.phase === "setup") return state;
  const active = state.phase === "bracket" ? "bracket" : "groups";
  const matches = cloneMatches(state.matches).map((match) =>
    match.stage === active ? match : { ...match, courtNumber: null },
  );

  for (const match of matches) {
    if (match.stage !== active) continue;
    if (
      match.status === "reported" ||
      match.status === "bye" ||
      thirdPlaceFollowsFinal(state, match)
    ) {
      match.courtNumber = null;
    } else if (
      match.courtNumber != null &&
      (match.courtNumber > state.courtCount ||
        match.courtNumber < 1 ||
        !courtsForCategory(state).includes(match.courtNumber) ||
        !match.teamAId ||
        !match.teamBId)
    ) {
      match.courtNumber = null;
    }
  }

  const occupied = new Set<number>();
  const busy = new Set<string>();
  for (const match of matches) {
    if (match.stage !== active || match.status !== "unreported") continue;
    if (match.courtNumber == null || !match.teamAId || !match.teamBId) continue;
    occupied.add(match.courtNumber);
    busy.add(match.teamAId);
    busy.add(match.teamBId);
  }

  const waiting = matches
    .filter(
      (match) =>
        match.stage === active &&
        match.status === "unreported" &&
        match.courtNumber == null &&
        match.teamAId &&
        match.teamBId &&
        !thirdPlaceFollowsFinal(state, match),
    )
    .sort((a, b) => a.round - b.round || a.number - b.number);

  for (const match of waiting) {
    if (!match.teamAId || !match.teamBId) continue;
    if (busy.has(match.teamAId) || busy.has(match.teamBId)) continue;
    const allowed = new Set(courtsForCategory(state));
    let court: number | null = null;
    for (let number = 1; number <= state.courtCount; number += 1) {
      if (allowed.has(number) && !occupied.has(number)) {
        court = number;
        break;
      }
    }
    if (court == null) continue;
    match.courtNumber = court;
    occupied.add(court);
    busy.add(match.teamAId);
    busy.add(match.teamBId);
  }

  return { ...state, matches };
}

export function groupStandings(
  state: TournamentState,
  groupId: string,
): StandingRow[] {
  const group = state.groups.find((item) => item.id === groupId);
  if (!group) return [];

  const totals = new Map<
    string,
    { wins: number; losses: number; pointsFor: number; pointsAgainst: number }
  >();
  for (const teamId of group.teamIds) {
    totals.set(teamId, { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 });
  }

  const headToHead = new Map<string, string>();
  for (const match of state.matches) {
    if (match.groupId !== groupId || match.status !== "reported") continue;
    if (!match.teamAId || !match.teamBId) continue;
    const winner = matchWinnerId(match);
    if (!winner) continue;
    const loser = winner === match.teamAId ? match.teamBId : match.teamAId;
    const winnerRow = totals.get(winner);
    const loserRow = totals.get(loser);
    if (winnerRow) winnerRow.wins += 1;
    if (loserRow) loserRow.losses += 1;
    headToHead.set(pairKey(match.teamAId, match.teamBId), winner);
    for (const game of match.games) {
      const aRow = totals.get(match.teamAId);
      const bRow = totals.get(match.teamBId);
      if (aRow) {
        aRow.pointsFor += game.a;
        aRow.pointsAgainst += game.b;
      }
      if (bRow) {
        bRow.pointsFor += game.b;
        bRow.pointsAgainst += game.a;
      }
    }
  }

  const rows: StandingRow[] = group.teamIds.map((teamId) => {
    const total = totals.get(teamId) ?? {
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    };
    return {
      rank: 0,
      teamId,
      name: teamName(state, teamId),
      wins: total.wins,
      losses: total.losses,
      pointsFor: total.pointsFor,
      pointsAgainst: total.pointsAgainst,
      diff: total.pointsFor - total.pointsAgainst,
    };
  });

  rows.sort((a, b) => compareStandings(a, b, rows, headToHead));
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

/** Match wins for each club, across every category. Byes do not count. */
export function clubStandings(event: TournamentEvent): ClubStanding[] {
  const totals = new Map<string, { wins: number; losses: number }>();
  for (const club of event.clubs) {
    totals.set(club, { wins: 0, losses: 0 });
  }
  for (const category of event.categories) {
    for (const match of category.matches) {
      if (match.status !== "reported") continue;
      const winnerId = matchWinnerId(match);
      if (!winnerId) continue;
      const loserId =
        winnerId === match.teamAId ? match.teamBId : match.teamAId;
      addClubResult(totals, clubOf(category, winnerId), "wins");
      addClubResult(totals, clubOf(category, loserId), "losses");
    }
  }
  return event.clubs
    .map((club) => {
      const total = totals.get(club) ?? { wins: 0, losses: 0 };
      return { club, wins: total.wins, losses: total.losses };
    })
    .sort(
      (a, b) =>
        b.wins - a.wins || a.losses - b.losses || a.club.localeCompare(b.club),
    );
}

export function matchWinnerId(match: TournamentMatch): string | null {
  if (match.status === "bye") return match.teamAId ?? match.teamBId;
  if (match.games.length === 0) return null;
  let aWins = 0;
  let bWins = 0;
  let aPoints = 0;
  let bPoints = 0;
  for (const game of match.games) {
    if (game.a === game.b) return null;
    if (game.a > game.b) aWins += 1;
    else bWins += 1;
    aPoints += game.a;
    bPoints += game.b;
  }
  if (aWins !== bWins) return aWins > bWins ? match.teamAId : match.teamBId;
  if (aPoints !== bPoints)
    return aPoints > bPoints ? match.teamAId : match.teamBId;
  return null;
}

/**
 * Round-robin bracket sizes for the current team list.
 * Teams per bracket is that group size, not the final elimination bracket.
 */
export function planBracketSizes(
  teamCount: number,
  bracketCount: number,
  teamsPerBracket: number,
): number[] {
  if (
    !Number.isInteger(bracketCount) ||
    bracketCount < 1 ||
    bracketCount > 16
  ) {
    throw new TournamentError("Use 1 to 16 brackets.");
  }
  if (
    !Number.isInteger(teamsPerBracket) ||
    teamsPerBracket < 2 ||
    teamsPerBracket > 8
  ) {
    throw new TournamentError("Each bracket holds 2 to 8 teams.");
  }
  const capacity = bracketCount * teamsPerBracket;
  if (teamCount > capacity) {
    const noun = bracketCount === 1 ? "bracket" : "brackets";
    const verb = bracketCount === 1 ? "holds" : "hold";
    throw new TournamentError(
      `${bracketCount} ${noun} of ${teamsPerBracket} ${verb} ${capacity} teams. You have ${teamCount}.`,
    );
  }
  const minimum = bracketCount * 2;
  if (teamCount < minimum) {
    throw new TournamentError(
      `Each bracket needs at least 2 teams. ${bracketCount} ${bracketCount === 1 ? "bracket needs" : "brackets need"} at least ${minimum}.`,
    );
  }
  const base = Math.floor(teamCount / bracketCount);
  const extra = teamCount % bracketCount;
  return Array.from(
    { length: bracketCount },
    (_, index) => base + (index < extra ? 1 : 0),
  );
}

export function stageProgress(
  state: TournamentState,
  stage: "groups" | "bracket",
): { reported: number; total: number } {
  const matches = state.matches.filter(
    (match) => match.stage === stage && match.status !== "bye",
  );
  return {
    total: matches.length,
    reported: matches.filter((match) => match.status === "reported").length,
  };
}

export function bracketChampion(state: TournamentState): TournamentTeam | null {
  const final = championshipMatch(state.matches);
  if (!final || final.status !== "reported") return null;
  const winnerId = matchWinnerId(final);
  if (!winnerId) return null;
  return state.teams.find((team) => team.id === winnerId) ?? null;
}

export function displayTournamentName(state: TournamentState): string {
  return state.name.trim() || "Club tournament";
}

export function displayDivision(state: TournamentState): string {
  return state.division.trim() || "Open";
}

export function teamName(
  state: TournamentState,
  teamId: string | null,
): string {
  if (!teamId) return "TBD";
  return state.teams.find((team) => team.id === teamId)?.name ?? "TBD";
}

export function bracketName(index: number): string {
  return `Bracket ${groupLetter(index)}`;
}

export function formatDiff(diff: number): string {
  if (diff > 0) return `+${diff}`;
  return String(diff);
}

/** Groups and rounds through the quarterfinals, then semis, the final, and third place. */
export function pointsToWin(
  state: TournamentState,
  match: TournamentMatch,
): number {
  if (match.stage !== "bracket") return state.pointsToQuarters;
  if (isThirdPlaceMatch(match)) return state.pointsSemisFinal;
  let lastRound = 1;
  for (const item of state.matches) {
    if (item.stage === "bracket" && item.round > lastRound) {
      lastRound = item.round;
    }
  }
  return match.round >= lastRound - 1
    ? state.pointsSemisFinal
    : state.pointsToQuarters;
}

export function roundLabel(
  matchCount: number,
  round: number,
  rounds: number,
): string {
  if (round === rounds) return "Final";
  if (matchCount === 2) return "Semifinals";
  if (matchCount === 4) return "Quarterfinals";
  if (matchCount === 8) return "Round of 16";
  return `Round ${round}`;
}

export function isThirdPlaceMatch(match: TournamentMatch): boolean {
  return match.placement === "third" || match.id === THIRD_PLACE_MATCH_ID;
}

/** True while the championship final still has to be played. */
export function thirdPlaceFollowsFinal(
  state: TournamentState,
  match: TournamentMatch,
): boolean {
  if (!isThirdPlaceMatch(match)) return false;
  const final = championshipMatch(state.matches);
  return !final || (final.status !== "reported" && final.status !== "bye");
}

export interface BracketColumnGroup {
  label: string;
  matches: TournamentMatch[];
}

export interface BracketColumn {
  key: string;
  groups: BracketColumnGroup[];
}

/** Championship rounds. Third place sits under the final and is played after it. */
export function bracketColumns(state: TournamentState): BracketColumn[] {
  const matches = state.matches.filter((match) => match.stage === "bracket");
  const main = matches.filter((match) => !isThirdPlaceMatch(match));
  const third = matches
    .filter(isThirdPlaceMatch)
    .sort((a, b) => a.slot - b.slot || a.number - b.number);
  const rounds = [...new Set(main.map((match) => match.round))].sort(
    (a, b) => a - b,
  );
  const lastRound = rounds[rounds.length - 1] ?? 1;
  return rounds.map((round) => {
    const inRound = main
      .filter((match) => match.round === round)
      .sort((a, b) => a.slot - b.slot);
    const groups: BracketColumnGroup[] = [
      {
        label: roundLabel(inRound.length, round, lastRound),
        matches: inRound,
      },
    ];
    if (round === lastRound && third.length > 0) {
      groups.push({ label: "Third place", matches: third });
    }
    return { key: `round-${round}`, groups };
  });
}

function championshipMatch(
  matches: TournamentMatch[],
): TournamentMatch | undefined {
  return matches
    .filter((match) => match.stage === "bracket" && !isThirdPlaceMatch(match))
    .sort((a, b) => b.round - a.round || a.slot - b.slot)[0];
}

function compareStandings(
  a: StandingRow,
  b: StandingRow,
  rows: StandingRow[],
  headToHead: Map<string, string>,
): number {
  if (b.wins !== a.wins) return b.wins - a.wins;
  const tied = rows.filter((row) => row.wins === a.wins);
  if (tied.length === 2) {
    const winner = headToHead.get(pairKey(a.teamId, b.teamId));
    if (winner === a.teamId) return -1;
    if (winner === b.teamId) return 1;
  }
  if (b.diff !== a.diff) return b.diff - a.diff;
  if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
  return a.name.localeCompare(b.name);
}

function advancingTeamIds(state: TournamentState): string[] {
  const ranked: Array<{
    teamId: string;
    place: number;
    diff: number;
    pointsFor: number;
    name: string;
  }> = [];
  for (const group of state.groups) {
    const rows = groupStandings(state, group.id);
    rows.slice(0, state.advancePerGroup).forEach((row, index) => {
      ranked.push({
        teamId: row.teamId,
        place: index + 1,
        diff: row.diff,
        pointsFor: row.pointsFor,
        name: row.name,
      });
    });
  }
  ranked.sort((a, b) => {
    if (a.place !== b.place) return a.place - b.place;
    if (b.diff !== a.diff) return b.diff - a.diff;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    return a.name.localeCompare(b.name);
  });
  return ranked.map((row) => row.teamId);
}

/**
 * Standard single-elim seeding. Size 8 → [1, 8, 4, 5, 2, 7, 3, 6]
 * so 1 plays 8 and the halves stay separated.
 */
function seedPositions(size: number): number[] {
  let positions = [1];
  while (positions.length < size) {
    const next: number[] = [];
    const sum = positions.length * 2 + 1;
    for (const seed of positions) next.push(seed, sum - seed);
    positions = next;
  }
  return positions;
}

function syncBracket(state: TournamentState): TournamentState {
  const matches = attachThirdPlace(cloneMatches(state.matches));
  const byId = new Map(matches.map((match) => [match.id, match]));
  const bracket = matches
    .filter((match) => match.stage === "bracket")
    .sort((a, b) => a.round - b.round || a.slot - b.slot);

  for (const match of bracket) {
    if (match.nextMatchId && match.nextSlot) {
      const next = byId.get(match.nextMatchId);
      if (next) {
        const winner =
          match.status === "bye"
            ? (match.teamAId ?? match.teamBId)
            : matchWinnerId(match);
        placeTeam(next, match.nextSlot, winner);
      }
    }
    if (match.loserNextMatchId && match.loserNextSlot) {
      const next = byId.get(match.loserNextMatchId);
      if (next) {
        const loser = match.status === "bye" ? null : matchLoserId(match);
        placeTeam(next, match.loserNextSlot, loser);
      }
    }
  }

  holdThirdPlace(matches);
  return { ...state, matches };
}

function holdThirdPlace(matches: TournamentMatch[]) {
  const final = championshipMatch(matches);
  const open =
    !final || (final.status !== "reported" && final.status !== "bye");
  if (!open) return;
  for (const match of matches) {
    if (!isThirdPlaceMatch(match) || match.status === "bye") continue;
    match.games = [];
    match.status = "unreported";
    match.courtNumber = null;
    match.live = null;
    match.claim = null;
  }
}

function attachThirdPlace(matches: TournamentMatch[]): TournamentMatch[] {
  const main = matches.filter(
    (match) => match.stage === "bracket" && !isThirdPlaceMatch(match),
  );
  if (main.length === 0) return matches;
  let lastRound = 1;
  for (const match of main) {
    if (match.round > lastRound) lastRound = match.round;
  }
  if (lastRound < 2) return matches;
  const semis = main
    .filter((match) => match.round === lastRound - 1)
    .sort((a, b) => a.slot - b.slot);
  if (semis.length !== 2 || semis.some((match) => match.status === "bye")) {
    return matches;
  }

  const linked = matches.map((match) => {
    const semi = semis.find((item) => item.id === match.id);
    if (!semi) return match;
    return {
      ...match,
      loserNextMatchId: THIRD_PLACE_MATCH_ID,
      loserNextSlot: semi.slot % 2 === 0 ? ("a" as const) : ("b" as const),
    };
  });
  if (linked.some(isThirdPlaceMatch)) return linked;

  const number =
    linked.reduce((max, match) => Math.max(max, match.number), 0) + 1;
  linked.push({
    id: THIRD_PLACE_MATCH_ID,
    stage: "bracket",
    groupId: null,
    round: lastRound,
    slot: 1,
    number,
    courtNumber: null,
    teamAId: null,
    teamBId: null,
    games: [],
    status: "unreported",
    nextMatchId: null,
    nextSlot: null,
    placement: "third",
  });
  return linked;
}

function placeTeam(
  next: TournamentMatch,
  slot: "a" | "b",
  teamId: string | null,
) {
  if (slot === "a") {
    if (next.teamAId !== teamId) {
      next.teamAId = teamId;
      clearDownstream(next);
    }
    return;
  }
  if (next.teamBId !== teamId) {
    next.teamBId = teamId;
    clearDownstream(next);
  }
}

function matchLoserId(match: TournamentMatch): string | null {
  const winnerId = matchWinnerId(match);
  if (!winnerId) return null;
  if (winnerId === match.teamAId) return match.teamBId;
  return winnerId === match.teamBId ? match.teamAId : null;
}

function clearDownstream(match: TournamentMatch) {
  if (match.status === "bye") return;
  match.games = [];
  match.status = "unreported";
  match.courtNumber = null;
}

function assertGames(
  games: GameScore[],
  teamAId: string | null,
  teamBId: string | null,
  gamesPerMatch: number,
  points: number,
): GameScore[] {
  if (!teamAId || !teamBId) {
    throw new TournamentError(
      "Both teams have to be on the match before you can enter a score.",
    );
  }
  if (games.length !== gamesPerMatch) {
    throw new TournamentError(
      gamesPerMatch === 1
        ? "This match is 1 game."
        : `This match is ${gamesPerMatch} games.`,
    );
  }
  const clean = games.map((game) => {
    if (!isGameScore(game.a) || !isGameScore(game.b)) {
      throw new TournamentError(
        "Game scores have to be whole numbers from 0 to 99.",
      );
    }
    if (game.a === game.b)
      throw new TournamentError("A game can't end in a tie.");
    if (Math.max(game.a, game.b) < points) {
      throw new TournamentError(`This game is played to ${points}.`);
    }
    return { a: game.a, b: game.b };
  });
  const winner = matchWinnerId({
    id: "score",
    stage: "groups",
    groupId: null,
    round: 1,
    slot: 0,
    number: 1,
    courtNumber: null,
    teamAId,
    teamBId,
    games: clean,
    status: "reported",
    nextMatchId: null,
    nextSlot: null,
  });
  if (!winner) throw new TournamentError("That match is still tied.");
  return clean;
}

function dealUnassigned(state: TournamentState): string[][] {
  planBracketSizes(
    state.teams.length,
    state.bracketCount,
    state.teamsPerBracket,
  );
  return dealTeams(
    state.teams.map((team) => team.id),
    state.bracketCount,
  );
}

function manualBracketGroups(state: TournamentState): string[][] {
  const groups = Array.from(
    { length: state.bracketCount },
    () => [] as string[],
  );
  for (const team of state.teams) {
    const index = team.bracketIndex;
    if (index == null || index < 0 || index >= state.bracketCount) {
      throw new TournamentError("Assign every team to a bracket.");
    }
    groups[index].push(team.id);
  }
  for (const [index, ids] of groups.entries()) {
    if (ids.length > state.teamsPerBracket) {
      throw new TournamentError(
        `${bracketName(index)} holds ${state.teamsPerBracket} teams. You assigned ${ids.length}.`,
      );
    }
  }
  for (const [index, ids] of groups.entries()) {
    if (ids.length < 2) {
      throw new TournamentError(
        `Assign at least 2 teams to ${bracketName(index)}.`,
      );
    }
  }
  return groups;
}

function keptBracketIndex(
  value: number | null | undefined,
  bracketCount: number,
): number | null {
  if (value == null || !Number.isInteger(value)) return null;
  if (value < 0 || value >= bracketCount) return null;
  return value;
}

/** Snake draft so early entries are spread across brackets. */
function dealTeams(teamIds: string[], groupCount: number): string[][] {
  const groups = Array.from({ length: groupCount }, () => [] as string[]);
  teamIds.forEach((id, index) => {
    const row = Math.floor(index / groupCount);
    const col = index % groupCount;
    const groupIndex = row % 2 === 0 ? col : groupCount - 1 - col;
    groups[groupIndex].push(id);
  });
  return groups;
}

function roundRobinRounds(teamIds: string[]): Array<Array<[string, string]>> {
  const ids = [...teamIds];
  if (ids.length < 2) return [];
  if (ids.length % 2 === 1) ids.push(BYE);
  const count = ids.length;
  const fixed = ids[0];
  let rotating = ids.slice(1);
  const rounds: Array<Array<[string, string]>> = [];

  for (let round = 0; round < count - 1; round += 1) {
    const row = [fixed, ...rotating];
    const pairs: Array<[string, string]> = [];
    for (let index = 0; index < count / 2; index += 1) {
      const a = row[index];
      const b = row[count - 1 - index];
      if (a !== BYE && b !== BYE) pairs.push([a, b]);
    }
    rounds.push(pairs);
    const last = rotating[rotating.length - 1];
    rotating = [last, ...rotating.slice(0, -1)];
  }
  return rounds;
}

function findMatch(state: TournamentState, matchId: string): TournamentMatch {
  const match = state.matches.find((item) => item.id === matchId);
  if (!match) throw new TournamentError("That match is not on the draw.");
  return match;
}

function assertSetup(state: TournamentState) {
  if (state.phase !== "setup") {
    throw new TournamentError("Reset the draw before changing teams.");
  }
}

function cloneMatches(matches: TournamentMatch[]): TournamentMatch[] {
  return matches.map((match) => ({
    ...match,
    games: match.games.map((game) => ({ a: game.a, b: game.b })),
    live: cloneLive(match.live),
    claim: sanitizeClaim(match.claim),
  }));
}

function writeClaim(
  state: TournamentState,
  matchId: string,
  claim: UmpireClaim | null,
): TournamentState {
  return {
    ...state,
    matches: state.matches.map((match) =>
      match.id === matchId ? { ...match, claim } : match,
    ),
  };
}

function assertCaller(
  match: TournamentMatch,
  umpireId: string | undefined,
  now: number,
) {
  if (umpireId && matchClaimHeldByOther(match, umpireId, now)) {
    throw new TournamentError("Another umpire is calling this court.");
  }
}

function sanitizeClaim(value: unknown): UmpireClaim | null {
  if (!value || typeof value !== "object") return null;
  const claim = value as UmpireClaim;
  const umpireId =
    typeof claim.umpireId === "string" ? claim.umpireId.trim() : "";
  if (!umpireId) return null;
  if (!Number.isInteger(claim.claimedAt) || claim.claimedAt <= 0) return null;
  return { umpireId, claimedAt: claim.claimedAt };
}

function cloneLive(live: RallyLive | null | undefined): RallyLive | null {
  const clean = sanitizeLive(live);
  if (!clean) return null;
  return {
    ...clean,
    past: clean.past.map((snap) => ({ ...snap })),
  };
}

function isRallySnapshot(value: unknown): value is RallySnapshot {
  if (!value || typeof value !== "object") return false;
  const snap = value as RallySnapshot;
  return (
    isGameScore(snap.scoreA) &&
    isGameScore(snap.scoreB) &&
    (snap.serving === null || snap.serving === "a" || snap.serving === "b") &&
    (snap.server === 1 || snap.server === 2)
  );
}

function sanitizeLive(value: unknown): RallyLive | null {
  if (!value || typeof value !== "object") return null;
  const live = value as RallyLive;
  if (!isRallySnapshot(live)) return null;
  if (!Number.isInteger(live.gameIndex) || live.gameIndex < 0) return null;
  const past = Array.isArray(live.past)
    ? live.past.filter(isRallySnapshot).slice(-40)
    : [];
  return {
    gameIndex: live.gameIndex,
    scoreA: live.scoreA,
    scoreB: live.scoreB,
    serving: live.serving,
    server: live.server,
    past,
    firstServerA: playerSlot(live.firstServerA),
    firstServerB: playerSlot(live.firstServerB),
  };
}

function playerSlot(value: unknown): 0 | 1 | null {
  if (value === 0 || value === 1) return value;
  return null;
}

function isTeam(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const team = value as TournamentTeam;
  return typeof team.id === "string" && typeof team.name === "string";
}

function isGroup(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const group = value as TournamentGroup;
  return (
    typeof group.id === "string" &&
    typeof group.name === "string" &&
    Array.isArray(group.teamIds)
  );
}

function isMatch(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const match = value as TournamentMatch;
  return (
    typeof match.id === "string" &&
    Array.isArray(match.games) &&
    (match.status === "unreported" ||
      match.status === "reported" ||
      match.status === "bye")
  );
}

function isGameScore(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 99
  );
}

function nextPowerOfTwo(value: number): number {
  let size = 1;
  while (size < value) size *= 2;
  return size;
}

function nextId(prefix: string, ids: string[]): string {
  let max = 0;
  for (const id of ids) {
    if (!id.startsWith(prefix)) continue;
    const parsed = Number.parseInt(id.slice(prefix.length), 10);
    if (Number.isInteger(parsed) && parsed > max) max = parsed;
  }
  return `${prefix}${max + 1}`;
}

function groupLetter(index: number): string {
  if (index < 26) return String.fromCharCode(65 + index);
  return String(index + 1);
}

function clip(value: string, max: number): string {
  return value.slice(0, max);
}

function sanitizeSponsor(value: unknown): TournamentSponsor | null {
  if (!value || typeof value !== "object") return null;
  const sponsor = value as TournamentSponsor;
  if (typeof sponsor.id !== "string" || !SPONSOR_ID.test(sponsor.id)) {
    return null;
  }
  if (typeof sponsor.url !== "string" || !isSponsorLogoUrl(sponsor.url)) {
    return null;
  }
  const name =
    typeof sponsor.name === "string" ? clip(sponsor.name.trim(), MAX_NAME) : "";
  return {
    id: sponsor.id,
    name,
    url: sponsor.url,
    tier: sanitizeSponsorTier(sponsor.tier),
  };
}

function sanitizeSponsorTier(value: unknown): SponsorTier {
  if (typeof value === "string" && isSponsorTier(value)) return value;
  if (value === "major") return "platinum";
  if (value === "minor") return "gold";
  return "nickel";
}

function sanitizeSponsors(value: unknown): TournamentSponsor[] {
  if (!Array.isArray(value)) return [];
  const sponsors: TournamentSponsor[] = [];
  for (const item of value) {
    const sponsor = sanitizeSponsor(item);
    if (!sponsor) continue;
    if (sponsors.some((existing) => existing.id === sponsor.id)) continue;
    if (sponsors.length >= MAX_SPONSOR_LOGOS) break;
    sponsors.push(sponsor);
  }
  return sponsors;
}

function sanitizeClub(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const club = clip(value.trim(), MAX_CLUB);
  return club || null;
}

function sanitizeClubs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const clubs: string[] = [];
  for (const item of value) {
    const club = sanitizeClub(item);
    if (!club) continue;
    if (
      clubs.some((existing) => existing.toLowerCase() === club.toLowerCase())
    ) {
      continue;
    }
    if (clubs.length >= MAX_CLUBS) break;
    clubs.push(club);
  }
  return clubs;
}

function clubsOnEvent(
  listed: unknown,
  categories: TournamentState[],
): string[] {
  const clubs = sanitizeClubs(listed);
  if (clubs.length > 0) return clubs;
  return sanitizeClubs(
    categories.flatMap((category) => category.teams.map((team) => team.club)),
  );
}

function canonicalClub(
  club: string | null,
  clubs: readonly string[],
): string | null {
  if (!club) return null;
  return (
    clubs.find((item) => item.toLowerCase() === club.toLowerCase()) ?? null
  );
}

function clubOf(state: TournamentState, teamId: string | null): string | null {
  if (!teamId) return null;
  return state.teams.find((team) => team.id === teamId)?.club ?? null;
}

function addClubResult(
  totals: Map<string, { wins: number; losses: number }>,
  club: string | null,
  field: "wins" | "losses",
): void {
  if (!club) return;
  const total = totals.get(club);
  if (!total) return;
  total[field] += 1;
}

function clampRallyPoints(value: number | undefined, fallback: number): number {
  if (value == null || !Number.isInteger(value)) return fallback;
  return Math.min(99, Math.max(1, value));
}

function clampGames(value: number | undefined): number {
  if (value == null || !Number.isInteger(value)) return 1;
  return Math.min(3, Math.max(1, value));
}

function clampBracketCount(value: number | undefined): number {
  if (value == null || !Number.isInteger(value)) return 2;
  return Math.min(16, Math.max(1, value));
}

function clampTeamsPerBracket(value: number | undefined): number {
  if (value == null || !Number.isInteger(value)) return 4;
  return Math.min(8, Math.max(2, value));
}

function clampAdvance(
  value: number | undefined,
  teamsPerBracket: number,
): number {
  const cap = clampTeamsPerBracket(teamsPerBracket);
  if (value == null || !Number.isInteger(value)) return Math.min(2, cap);
  return Math.min(cap, Math.max(1, value));
}

function requireInt(
  value: number,
  min: number,
  max: number,
  message: string,
): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new TournamentError(message);
  }
  return value;
}
