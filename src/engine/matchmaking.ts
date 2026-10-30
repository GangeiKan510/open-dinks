import { playerMatchesSkillBand, skillTierRank } from "@/lib/skill-tier";
import { isCourtBooked } from "./bookings";
import { count } from "./history";
import {
  takeNextCourtPlayers,
  findSeparatedTeamLocks,
  formatSeparatedTeamLockMessage,
} from "./locks";
import { orderedWaitingPlayers } from "./queue";
import type {
  EnginePlayer,
  EngineState,
  GameFormat,
  SessionMode,
} from "./types";

type SideInput = SessionMode | Pick<EngineState, "mode" | "format">;

export function resolveGameFormat(input: SideInput): GameFormat {
  if (typeof input === "string") {
    return input === "singles" ? "singles" : "doubles";
  }
  if (input.format === "singles" || input.mode === "singles") return "singles";
  return "doubles";
}

const PARTNER_WEIGHT = 3;
const OPPONENT_WEIGHT = 1;
const SKILL_WEIGHT = 2;
const AVOID_PENALTY = 1000;
const LOCK_BREAK_PENALTY = 500;
const TEAM_LOCK_BREAK_PENALTY = 2000;

export function playersPerSide(input: SideInput): number {
  return resolveGameFormat(input) === "singles" ? 1 : 2;
}

export function playersPerCourt(input: SideInput): number {
  return playersPerSide(input) * 2;
}

export function eligibleWaiting(state: EngineState): EnginePlayer[] {
  return orderedWaitingPlayers(state);
}

function respectsAvoid(group: EnginePlayer[]): boolean {
  for (const p of group) {
    for (const other of group) {
      if (p.id === other.id) continue;
      if (p.avoidIds?.includes(other.id)) return false;
    }
  }
  return true;
}

function lockOk(group: EnginePlayer[]): boolean {
  for (const p of group) {
    if (!p.partnerLockId) continue;
    const partnerInGroup = group.some((g) => g.id === p.partnerLockId);
    const partnerWaitingElsewhere = true; // checked by caller via penalty
    if (!partnerInGroup && partnerWaitingElsewhere) {
      // soft: scored via penalty rather than hard reject when partner unavailable
      void partnerWaitingElsewhere;
    }
  }
  return true;
}

function partnersAreLocked(a: EnginePlayer, b: EnginePlayer): boolean {
  return a.partnerLockId === b.id && b.partnerLockId === a.id;
}

/** Avoid lists, team locks, and partner locks. History and skill are separate. */
function constraintPenalty(
  state: EngineState,
  teamA: EnginePlayer[],
  teamB: EnginePlayer[],
): number {
  const group = [...teamA, ...teamB];
  let score = 0;

  if (!respectsAvoid(group)) score += AVOID_PENALTY;

  for (const p of group) {
    if (p.teamLockGroupId) {
      const members = state.players.filter(
        (x) => x.teamLockGroupId === p.teamLockGroupId,
      );
      const allInGroup = members.every((m) => group.some((g) => g.id === m.id));
      if (!allInGroup) {
        score += TEAM_LOCK_BREAK_PENALTY;
      }
    }

    if (p.partnerLockId) {
      const partnerOnSameTeam =
        (teamA.includes(p) && teamA.some((t) => t.id === p.partnerLockId)) ||
        (teamB.includes(p) && teamB.some((t) => t.id === p.partnerLockId));
      const partnerInMatch = group.some((g) => g.id === p.partnerLockId);
      if (partnerInMatch && !partnerOnSameTeam) {
        score += LOCK_BREAK_PENALTY;
      } else if (!partnerInMatch) {
        const partnerAvailable = state.players.some(
          (x) => x.id === p.partnerLockId && x.status === "waiting",
        );
        if (partnerAvailable) score += LOCK_BREAK_PENALTY / 2;
      }
    }
  }

  return score;
}

function partnerRepeatScore(state: EngineState, team: EnginePlayer[]): number {
  const weight = state.mode === "social_shuffle" ? 10_000 : PARTNER_WEIGHT;
  let score = 0;
  for (let i = 0; i < team.length; i++) {
    for (let j = i + 1; j < team.length; j++) {
      const repeats = count(state.partnerHistory, team[i].id, team[j].id);
      if (repeats === 0) continue;
      if (
        state.mode === "social_shuffle" &&
        partnersAreLocked(team[i], team[j])
      ) {
        continue;
      }
      score += repeats * weight;
    }
  }
  return score;
}

function pairingScore(
  state: EngineState,
  teamA: EnginePlayer[],
  teamB: EnginePlayer[],
): number {
  let score = constraintPenalty(state, teamA, teamB);
  score += partnerRepeatScore(state, teamA);
  score += partnerRepeatScore(state, teamB);
  for (const a of teamA) {
    for (const b of teamB) {
      score += count(state.opponentHistory, a.id, b.id) * OPPONENT_WEIGHT;
    }
  }

  const avg = (ps: EnginePlayer[]) =>
    ps.reduce((s, p) => s + skillTierRank(p.skill), 0) / ps.length;
  score += Math.abs(avg(teamA) - avg(teamB)) * SKILL_WEIGHT;

  return score;
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

function teamSplits(
  group: EnginePlayer[],
  perSide: number,
): Array<[EnginePlayer[], EnginePlayer[]]> {
  const splits: Array<[EnginePlayer[], EnginePlayer[]]> = [];
  const teamAOptions = combinations(group, perSide);
  for (const teamA of teamAOptions) {
    const teamAIds = new Set(teamA.map((p) => p.id));
    const teamB = group.filter((p) => !teamAIds.has(p.id));
    // Deduplicate mirror splits
    const key = [
      ...teamA.map((p) => p.id).sort(),
      "|",
      ...teamB.map((p) => p.id).sort(),
    ].join(",");
    const mirror = [
      ...teamB.map((p) => p.id).sort(),
      "|",
      ...teamA.map((p) => p.id).sort(),
    ].join(",");
    if (key <= mirror) {
      splits.push([teamA, teamB]);
    }
  }
  return splits;
}

export interface ProposedMatch {
  courtId: string;
  courtName: string;
  teamA: string[];
  teamB: string[];
  score: number;
}

function splitPickIndex(
  players: EnginePlayer[],
  now: number,
  count: number,
): number {
  if (count <= 1) return 0;
  let hash = now | 0;
  for (const player of players) {
    for (let i = 0; i < player.id.length; i++) {
      hash = (Math.imul(hash, 31) + player.id.charCodeAt(i)) | 0;
    }
    hash = (hash + player.gamesPlayed) | 0;
  }
  return Math.abs(hash ^ now) % count;
}

function isMixedSide(team: EnginePlayer[]): boolean {
  if (team.length !== 2) return false;
  const genders = team.map((player) => player.gender);
  return genders.includes("man") && genders.includes("woman");
}

function coupleHuntScore(
  state: EngineState,
  teamA: EnginePlayer[],
  teamB: EnginePlayer[],
): number {
  if (!isMixedSide(teamA) || !isMixedSide(teamB)) return 1_000_000;
  let score = constraintPenalty(state, teamA, teamB);
  for (const team of [teamA, teamB]) {
    const repeats = count(state.partnerHistory, team[0].id, team[1].id);
    if (repeats > 0 && !partnersAreLocked(team[0], team[1])) {
      score += 10_000 * repeats;
    }
  }
  return score;
}

function takeRatedGroup(
  pool: EnginePlayer[],
  perCourt: number,
  state: EngineState,
): EnginePlayer[] | null {
  if (pool.length < perCourt) return null;
  const anchor = skillTierRank(pool[0].skill);
  for (let window = 0; window <= 4; window++) {
    const near = pool.filter(
      (player) => Math.abs(skillTierRank(player.skill) - anchor) <= window,
    );
    const group = takeNextCourtPlayers(near, perCourt, state);
    if (group) return group;
  }
  return null;
}

function takeCourtKingsGroup(
  pool: EnginePlayer[],
  perCourt: number,
  state: EngineState,
): EnginePlayer[] | null {
  const winners = pool.filter((player) => player.lastResult === "win");
  const losers = pool.filter((player) => player.lastResult === "loss");
  if (winners.length >= perCourt) {
    return takeNextCourtPlayers(winners, perCourt, state);
  }
  if (losers.length >= perCourt) {
    return takeNextCourtPlayers(losers, perCourt, state);
  }
  return takeNextCourtPlayers(pool, perCourt, state);
}

function takeCoupleGroup(
  pool: EnginePlayer[],
  state: EngineState,
): EnginePlayer[] | null {
  const gendered = pool.filter(
    (player) => player.gender === "man" || player.gender === "woman",
  );
  const men = gendered.filter((player) => player.gender === "man");
  const women = gendered.filter((player) => player.gender === "woman");
  if (men.length < 2 || women.length < 2) return null;

  const seeded = [men[0], men[1], women[0], women[1]];
  if (seeded.some((player) => player.teamLockGroupId)) {
    const locked = takeNextCourtPlayers(gendered, 4, state);
    if (!locked) return null;
    const manCount = locked.filter((player) => player.gender === "man").length;
    if (manCount !== 2) return null;
    return locked;
  }
  return seeded;
}

function selectCourtGroup(
  pool: EnginePlayer[],
  perCourt: number,
  state: EngineState,
): EnginePlayer[] | null {
  if (state.mode === "rated") return takeRatedGroup(pool, perCourt, state);
  if (state.mode === "court_kings") {
    return takeCourtKingsGroup(pool, perCourt, state);
  }
  if (state.mode === "couple_hunt") return takeCoupleGroup(pool, state);
  return takeNextCourtPlayers(pool, perCourt, state);
}

function chooseTeams(
  state: EngineState,
  group: EnginePlayer[],
  perSide: number,
): [EnginePlayer[], EnginePlayer[]] | null {
  const splits = teamSplits(group, perSide);
  if (splits.length === 0) return null;

  if (state.mode === "all_random") {
    let bestPenalty = Number.POSITIVE_INFINITY;
    const tied: Array<[EnginePlayer[], EnginePlayer[]]> = [];
    for (const split of splits) {
      const penalty = constraintPenalty(state, split[0], split[1]);
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        tied.length = 0;
      }
      if (penalty === bestPenalty) tied.push(split);
    }
    return tied[splitPickIndex(group, state.now, tied.length)] ?? null;
  }

  let best: [EnginePlayer[], EnginePlayer[]] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const [teamA, teamB] of splits) {
    const score =
      state.mode === "couple_hunt"
        ? coupleHuntScore(state, teamA, teamB)
        : pairingScore(state, teamA, teamB);
    if (score < bestScore) {
      bestScore = score;
      best = [teamA, teamB];
    }
  }
  if (state.mode === "couple_hunt" && bestScore >= 1_000_000) return null;
  return best;
}

function filterByCourtSkill(
  waiting: EnginePlayer[],
  court: EngineState["courts"][number],
  mode: SessionMode,
): EnginePlayer[] {
  if (mode !== "skill_separated") return waiting;
  return waiting.filter((p) =>
    playerMatchesSkillBand(p.skill, court.skillMin, court.skillMax),
  );
}

/**
 * Propose assignments from the host waiting stack to free courts.
 * Takes the next players in stack order (not fairness auto-fill).
 */
export function proposeFillCourts(
  state: EngineState,
  options?: { courtIds?: string[] },
): ProposedMatch[] {
  const activeCourtIds = new Set(
    state.matches
      .filter((m) => m.status === "active" || m.status === "ready")
      .map((m) => m.courtId),
  );
  let freeCourts = state.courts.filter(
    (c) => !activeCourtIds.has(c.id) && !isCourtBooked(c, state.now),
  );
  if (options?.courtIds?.length) {
    const allowed = new Set(options.courtIds);
    freeCourts = freeCourts.filter((c) => allowed.has(c.id));
  }
  if (state.mode === "couple_hunt" && playersPerSide(state) === 1) {
    return [];
  }

  const perCourt = playersPerCourt(state);
  const perSide = playersPerSide(state);

  let waiting = orderedWaitingPlayers(state).filter(
    (player) =>
      state.playerGameLimit == null ||
      player.gamesPlayed < state.playerGameLimit,
  );
  const proposals: ProposedMatch[] = [];
  const used = new Set<string>();

  for (const court of freeCourts) {
    const pool = filterByCourtSkill(waiting, court, state.mode).filter(
      (p) => !used.has(p.id),
    );

    const group = selectCourtGroup(pool, perCourt, state);
    if (!group || !lockOk(group)) continue;

    const chosen = chooseTeams(state, group, perSide);
    const best: ProposedMatch | null = chosen
      ? {
          courtId: court.id,
          courtName: court.name,
          teamA: chosen[0].map((p) => p.id),
          teamB: chosen[1].map((p) => p.id),
          score: pairingScore(state, chosen[0], chosen[1]),
        }
      : null;

    if (best) {
      proposals.push(best);
      for (const id of [...best.teamA, ...best.teamB]) used.add(id);
      waiting = waiting.filter((p) => !used.has(p.id));
    }
  }

  return proposals;
}

/** Returns a host-facing reason when the stack cannot be pushed yet. */
export function getStackPushBlockReason(
  state: EngineState,
  options?: { courtIds?: string[] },
): string | null {
  const separated = findSeparatedTeamLocks(state);
  if (separated.length > 0) {
    return formatSeparatedTeamLockMessage(state, separated);
  }

  const perCourt = playersPerCourt(state);
  const waitingCount = state.players.filter(
    (p) => p.status === "waiting",
  ).length;
  const activeCourtIds = new Set(
    state.matches
      .filter((m) => m.status === "active" || m.status === "ready")
      .map((m) => m.courtId),
  );
  let freeCourts = state.courts.filter(
    (court) =>
      !activeCourtIds.has(court.id) && !isCourtBooked(court, state.now),
  );
  if (options?.courtIds?.length) {
    const allowed = new Set(options.courtIds);
    freeCourts = freeCourts.filter((court) => allowed.has(court.id));
  }

  if (freeCourts.length === 0 || waitingCount < perCourt) {
    return null;
  }

  if (proposeFillCourts(state, options).length === 0) {
    return "Unable to push the stack. Bring locked teams together and make sure the next group can fill a court.";
  }

  return null;
}

export function playCountSpread(players: EnginePlayer[]): number {
  const active = players.filter((p) => p.status !== "left");
  if (active.length === 0) return 0;
  const counts = active.map((p) => p.gamesPlayed);
  return Math.max(...counts) - Math.min(...counts);
}
