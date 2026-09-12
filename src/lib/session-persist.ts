import type { EngineMatch, EnginePlayer, EngineState } from "@/engine";
import { pairKey } from "@/lib/utils";
import type { Database } from "@/lib/supabase/database.types";

type SessionPlayerRow = Database["public"]["Tables"]["session_players"]["Row"];
type SessionPlayerInsert =
  Database["public"]["Tables"]["session_players"]["Insert"];
type SessionPlayerUpdate =
  Database["public"]["Tables"]["session_players"]["Update"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type MatchInsert = Database["public"]["Tables"]["matches"]["Insert"];
type MatchUpdate = Database["public"]["Tables"]["matches"]["Update"];
type PairingRow = Database["public"]["Tables"]["pairing_history"]["Row"];
type PairingInsert = Database["public"]["Tables"]["pairing_history"]["Insert"];
type CourtRow = Pick<
  Database["public"]["Tables"]["courts"]["Row"],
  "id" | "name"
>;

const occupied = (status: string) => status === "active" || status === "ready";

export type SessionPersistPlan = {
  playerInserts: Array<{ tempId: string; row: SessionPlayerInsert }>;
  playerUpdates: Array<{ id: string; patch: SessionPlayerUpdate }>;
  matchInserts: MatchInsert[];
  matchUpdates: Array<{ id: string; patch: MatchUpdate }>;
  matchDeletes: string[];
  sessionPatch: {
    mode: EngineState["mode"];
    max_game_minutes: number;
  } | null;
  pairingUpserts: PairingInsert[];
};

export function persistWriteCount(plan: SessionPersistPlan): number {
  return (
    plan.playerInserts.length +
    plan.playerUpdates.length +
    plan.matchInserts.length +
    plan.matchUpdates.length +
    (plan.matchDeletes.length > 0 ? 1 : 0) +
    (plan.sessionPatch ? 1 : 0) +
    (plan.pairingUpserts.length > 0 ? 1 : 0)
  );
}

function sameIds(
  a: string[] | null | undefined,
  b: string[] | null | undefined,
) {
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) return false;
  return left.every((id, index) => id === right[index]);
}

function isoFromMillis(ms: number | null | undefined): string | null {
  if (ms == null) return null;
  return new Date(ms).toISOString();
}

function sameTimestamp(
  iso: string | null | undefined,
  ms: number | null | undefined,
): boolean {
  if (!iso && ms == null) return true;
  if (!iso || ms == null) return false;
  return new Date(iso).getTime() === ms;
}

function playerPatch(player: EnginePlayer): SessionPlayerUpdate {
  return {
    display_name: player.name,
    skill: player.skill,
    status: player.status,
    games_played: player.gamesPlayed,
    last_played_at: isoFromMillis(player.lastPlayedAt),
    avoid_ids: player.avoidIds ?? [],
    consecutive_wins: player.consecutiveWins ?? 0,
    queue_order: player.queueOrder ?? null,
    team_lock_group_id: player.teamLockGroupId ?? null,
    partner_lock_id: player.partnerLockId ?? null,
  };
}

function playerUnchanged(
  existing: SessionPlayerRow,
  player: EnginePlayer,
): boolean {
  const patch = playerPatch(player);
  return (
    existing.display_name === patch.display_name &&
    existing.skill === patch.skill &&
    existing.status === patch.status &&
    existing.games_played === patch.games_played &&
    sameTimestamp(existing.last_played_at, player.lastPlayedAt) &&
    sameIds(existing.avoid_ids, patch.avoid_ids) &&
    existing.consecutive_wins === patch.consecutive_wins &&
    (existing.queue_order ?? null) === (patch.queue_order ?? null) &&
    (existing.team_lock_group_id ?? null) ===
      (patch.team_lock_group_id ?? null) &&
    (existing.partner_lock_id ?? null) === (patch.partner_lock_id ?? null)
  );
}

function matchUnchanged(existing: MatchRow, match: EngineMatch): boolean {
  return (
    sameIds(existing.team_a, match.teamA) &&
    sameIds(existing.team_b, match.teamB) &&
    existing.status === match.status &&
    (existing.winner ?? null) === (match.winner ?? null) &&
    sameTimestamp(existing.started_at, match.startedAt) &&
    sameTimestamp(existing.ended_at, match.endedAt ?? null)
  );
}

export function planSessionPersist(input: {
  sessionId: string;
  before: EngineState;
  after: EngineState;
  players: SessionPlayerRow[];
  matches: MatchRow[];
  courts: CourtRow[];
  pairings: PairingRow[];
}): SessionPersistPlan {
  const existingById = new Map(input.players.map((row) => [row.id, row]));
  const matchById = new Map(input.matches.map((row) => [row.id, row]));

  const playerInserts: SessionPersistPlan["playerInserts"] = [];
  const playerUpdates: SessionPersistPlan["playerUpdates"] = [];

  for (const player of input.after.players) {
    const existing = existingById.get(player.id);
    if (!existing) {
      playerInserts.push({
        tempId: player.id,
        row: {
          session_id: input.sessionId,
          display_name: player.name,
          skill: player.skill,
          status: player.status,
          games_played: player.gamesPlayed,
          partner_lock_id: null,
          avoid_ids: [],
          queue_order: player.queueOrder ?? null,
          team_lock_group_id: player.teamLockGroupId ?? null,
        },
      });
      continue;
    }
    if (!playerUnchanged(existing, player)) {
      playerUpdates.push({ id: player.id, patch: playerPatch(player) });
    }
  }

  const beforeOccupied = input.before.matches.filter((m) => occupied(m.status));
  const afterOccupied = input.after.matches.filter((m) => occupied(m.status));
  const afterCompleted = input.after.matches.filter(
    (m) => m.status === "completed",
  );

  const matchInserts: MatchInsert[] = [];
  const matchUpdates: SessionPersistPlan["matchUpdates"] = [];
  const matchDeletes: string[] = [];

  for (const match of afterCompleted) {
    const wasOccupied = beforeOccupied.find((row) => row.id === match.id);
    if (!wasOccupied) continue;
    const existing = matchById.get(match.id);
    if (existing && matchUnchanged(existing, match)) continue;
    matchUpdates.push({
      id: match.id,
      patch: {
        status: "completed",
        winner: match.winner ?? null,
        ended_at: isoFromMillis(match.endedAt) ?? new Date().toISOString(),
        team_a: match.teamA,
        team_b: match.teamB,
      },
    });
  }

  for (const match of afterOccupied) {
    const existing = matchById.get(match.id);
    const startedAt = isoFromMillis(match.startedAt);
    if (!existing) {
      const court = input.courts.find((row) => row.id === match.courtId);
      matchInserts.push({
        session_id: input.sessionId,
        court_id: court?.id ?? null,
        court_name: match.courtName,
        team_a: match.teamA,
        team_b: match.teamB,
        status: match.status,
        started_at: startedAt,
      });
      continue;
    }
    if (matchUnchanged(existing, match)) continue;
    matchUpdates.push({
      id: match.id,
      patch: {
        team_a: match.teamA,
        team_b: match.teamB,
        status: match.status,
        started_at: startedAt,
      },
    });
  }

  for (const match of beforeOccupied) {
    const still = input.after.matches.find((row) => row.id === match.id);
    if (!still) matchDeletes.push(match.id);
  }

  const sessionPatch =
    input.before.mode !== input.after.mode ||
    input.before.maxGameMinutes !== input.after.maxGameMinutes
      ? {
          mode: input.after.mode,
          max_game_minutes: input.after.maxGameMinutes,
        }
      : null;

  const pairingByKey = new Map(
    input.pairings.map((row) => [pairKey(row.player_a, row.player_b), row]),
  );
  const pairingUpserts: PairingInsert[] = [];
  const partnerKeys = new Set([
    ...Object.keys(input.after.partnerHistory),
    ...Object.keys(input.after.opponentHistory),
  ]);
  for (const key of partnerKeys) {
    const [a, b] = key.split("|");
    if (!a || !b) continue;
    const [playerA, playerB] = a < b ? [a, b] : [b, a];
    const asPartners = input.after.partnerHistory[key] ?? 0;
    const asOpponents = input.after.opponentHistory[key] ?? 0;
    const existing = pairingByKey.get(pairKey(playerA, playerB));
    if (
      existing &&
      existing.as_partners === asPartners &&
      existing.as_opponents === asOpponents
    ) {
      continue;
    }
    pairingUpserts.push({
      session_id: input.sessionId,
      player_a: playerA,
      player_b: playerB,
      as_partners: asPartners,
      as_opponents: asOpponents,
    });
  }

  return {
    playerInserts,
    playerUpdates,
    matchInserts,
    matchUpdates,
    matchDeletes,
    sessionPatch,
    pairingUpserts,
  };
}
