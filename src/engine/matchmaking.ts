import { playerMatchesSkillBand, skillTierRank } from "@/lib/skill-tier";
import { isCourtBooked } from "./bookings";
import { count } from "./history";
import {
  takeNextCourtPlayers,
  findSeparatedTeamLocks,
  formatSeparatedTeamLockMessage,
} from "./locks";
import { orderedWaitingPlayers } from "./queue";
import type { EnginePlayer, EngineState, SessionMode } from "./types";

const PARTNER_WEIGHT = 3;
const OPPONENT_WEIGHT = 1;
const SKILL_WEIGHT = 2;
const AVOID_PENALTY = 1000;
const LOCK_BREAK_PENALTY = 500;
const TEAM_LOCK_BREAK_PENALTY = 2000;

export function playersPerSide(mode: SessionMode): number {
  return mode === "singles" ? 1 : 2;
}

export function playersPerCourt(mode: SessionMode): number {
  return playersPerSide(mode) * 2;
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

function pairingScore(
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

  for (let i = 0; i < teamA.length; i++) {
    for (let j = i + 1; j < teamA.length; j++) {
      score +=
        count(state.partnerHistory, teamA[i].id, teamA[j].id) * PARTNER_WEIGHT;
    }
  }
  for (let i = 0; i < teamB.length; i++) {
    for (let j = i + 1; j < teamB.length; j++) {
      score +=
        count(state.partnerHistory, teamB[i].id, teamB[j].id) * PARTNER_WEIGHT;
    }
  }
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
  const perCourt = playersPerCourt(state.mode);
  const perSide = playersPerSide(state.mode);

  let waiting = orderedWaitingPlayers(state);
  const proposals: ProposedMatch[] = [];
  const used = new Set<string>();

  for (const court of freeCourts) {
    const pool = filterByCourtSkill(waiting, court, state.mode).filter(
      (p) => !used.has(p.id),
    );

    const group = takeNextCourtPlayers(pool, perCourt, state);
    if (!group) continue;

    let best: ProposedMatch | null = null;

    if (!lockOk(group)) continue;

    for (const [teamA, teamB] of teamSplits(group, perSide)) {
      const score = pairingScore(state, teamA, teamB);
      const candidate: ProposedMatch = {
        courtId: court.id,
        courtName: court.name,
        teamA: teamA.map((p) => p.id),
        teamB: teamB.map((p) => p.id),
        score,
      };
      if (!best || candidate.score < best.score) {
        best = candidate;
      }
    }

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

  const perCourt = playersPerCourt(state.mode);
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
