import { parseSkillTier } from "@/lib/skill-tier";
import { MIN_COURT_COUNT, normalizeCourtCount } from "@/lib/court-count";
import type { Database } from "@/lib/supabase/database.types";
import {
  createInitialState,
  type EngineCourt,
  type EngineCourtBooking,
  type EngineState,
  type SessionMode,
} from "@/engine";

type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
type SessionPlayerRow = Database["public"]["Tables"]["session_players"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type CourtRow = Database["public"]["Tables"]["courts"]["Row"];
type PairingRow = Database["public"]["Tables"]["pairing_history"]["Row"];
type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
type CoachingBusyInput = {
  id: string;
  court_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  label: string;
};

/**
 * Confirmed court holds per real court id, ascending by start.
 * Pending and cancelled rows are requests, not reservations, so they never
 * take a court out of open play.
 */
function groupConfirmedCourtBusy(
  rows: CoachingBusyInput[],
): Map<string, EngineCourtBooking[]> {
  const byCourt = new Map<string, EngineCourtBooking[]>();

  for (const row of rows) {
    if (row.status !== "confirmed") continue;
    const startsAt = new Date(row.starts_at).getTime();
    const endsAt = new Date(row.ends_at).getTime();
    if (Number.isNaN(startsAt) || Number.isNaN(endsAt)) continue;

    const existing = byCourt.get(row.court_id);
    const booking: EngineCourtBooking = {
      id: row.id,
      label: row.label,
      startsAt,
      endsAt,
    };
    if (existing) existing.push(booking);
    else byCourt.set(row.court_id, [booking]);
  }

  for (const bookings of byCourt.values()) {
    bookings.sort((a, b) => a.startsAt - b.startsAt);
  }

  return byCourt;
}

function resolveSessionCourts(
  courtRows: CourtRow[],
  sessionCourtCount: number,
  bookingRows: BookingRow[],
  coachingRows: CoachingBusyInput[] = [],
): EngineCourt[] {
  const count = normalizeCourtCount(sessionCourtCount, MIN_COURT_COUNT);
  const sorted = courtRows.slice().sort((a, b) => a.sort_order - b.sort_order);
  const bookingsByCourt = groupConfirmedCourtBusy([
    ...bookingRows.map((row) => ({
      id: row.id,
      court_id: row.court_id,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      status: row.status,
      label: row.booked_by_name,
    })),
    ...coachingRows,
  ]);

  const fromDb = sorted.slice(0, count).map((c) => ({
    id: c.id,
    name: c.name,
    skillMin: c.skill_min ? parseSkillTier(c.skill_min) : undefined,
    skillMax: c.skill_max ? parseSkillTier(c.skill_max) : undefined,
    bookings: bookingsByCourt.get(c.id),
  }));

  if (fromDb.length >= count) {
    return fromDb;
  }

  // Padding courts have no `courts` row, so nothing can be booked against them.
  const virtual = Array.from({ length: count - fromDb.length }, (_, i) => ({
    id: `virtual_${fromDb.length + i + 1}`,
    name: `Court ${fromDb.length + i + 1}`,
  }));

  return [...fromDb, ...virtual];
}

export function dbToEngineState(input: {
  session: SessionRow;
  players: SessionPlayerRow[];
  matches: MatchRow[];
  courts: CourtRow[];
  pairings: PairingRow[];
  bookings?: BookingRow[];
  coachingBookings?: Array<{
    id: string;
    court_id: string;
    starts_at: string;
    ends_at: string;
    status: string;
    booked_by_name?: string;
  }>;
}): EngineState {
  const partnerHistory: Record<string, number> = {};
  const opponentHistory: Record<string, number> = {};
  for (const p of input.pairings) {
    const key = `${p.player_a}|${p.player_b}`;
    partnerHistory[key] = p.as_partners;
    opponentHistory[key] = p.as_opponents;
  }

  const coachingBusy: CoachingBusyInput[] = (input.coachingBookings ?? []).map(
    (row) => ({
      id: row.id,
      court_id: row.court_id,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      status: row.status,
      label: row.booked_by_name
        ? `Coaching · ${row.booked_by_name}`
        : "Coaching",
    }),
  );

  const courts = resolveSessionCourts(
    input.courts,
    input.session.court_count,
    input.bookings ?? [],
    coachingBusy,
  );

  return createInitialState({
    mode: input.session.mode as SessionMode,
    kingMaxConsecutiveWins: input.session.king_max_consecutive_wins,
    maxGameMinutes: input.session.max_game_minutes ?? 15,
    now: Date.now(),
    courts,
    players: input.players.map((p) => ({
      id: p.id,
      name: p.display_name,
      skill: parseSkillTier(p.skill),
      status: p.status,
      gamesPlayed: p.games_played,
      lastPlayedAt: p.last_played_at
        ? new Date(p.last_played_at).getTime()
        : null,
      checkedInAt: new Date(p.checked_in_at).getTime(),
      partnerLockId: p.partner_lock_id,
      avoidIds: p.avoid_ids ?? [],
      consecutiveWins: p.consecutive_wins,
      queueOrder: p.queue_order ?? undefined,
      teamLockGroupId: p.team_lock_group_id ?? undefined,
    })),
    matches: input.matches.map((m) => ({
      id: m.id,
      courtId: m.court_id ?? m.court_name,
      courtName: m.court_name,
      teamA: m.team_a,
      teamB: m.team_b,
      status: m.status as "ready" | "active" | "completed",
      winner: (m.winner as "a" | "b" | null) ?? null,
      startedAt: m.started_at ? new Date(m.started_at).getTime() : null,
      endedAt: m.ended_at ? new Date(m.ended_at).getTime() : null,
    })),
    partnerHistory,
    opponentHistory,
  });
}
