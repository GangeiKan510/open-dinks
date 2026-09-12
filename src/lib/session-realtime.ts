type RealtimeRow = Record<string, unknown> | null | undefined;

export type SessionRealtimeEvent = {
  table: string;
  new?: RealtimeRow;
  old?: RealtimeRow;
};

const SESSION_SCOPED_TABLES = new Set([
  "session_players",
  "matches",
  "pairing_history",
]);

const VENUE_SCOPED_TABLES = new Set(["bookings", "coaching_bookings"]);

function hasRowValues(row: RealtimeRow): row is Record<string, unknown> {
  if (row == null) return false;
  return Object.keys(row).length > 0;
}

function rowFromEvent(event: SessionRealtimeEvent): RealtimeRow {
  if (hasRowValues(event.new)) return event.new;
  if (hasRowValues(event.old)) return event.old;
  return null;
}

function asId(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Realtime is published per table, not per session. Ignore events that belong
 * to another session or venue. If the payload is missing the scope column
 * (DELETE with default replica identity), refresh anyway so we do not miss
 * our own deletes.
 */
export function isLiveSessionRealtimeEvent(
  event: SessionRealtimeEvent,
  session: { id: string; venue_id: string },
): boolean {
  const row = rowFromEvent(event);
  if (!row) return true;

  if (event.table === "sessions") {
    const id = asId(row.id);
    return id == null || id === session.id;
  }

  if (SESSION_SCOPED_TABLES.has(event.table)) {
    const sessionId = asId(row.session_id);
    return sessionId == null || sessionId === session.id;
  }

  if (VENUE_SCOPED_TABLES.has(event.table)) {
    const venueId = asId(row.venue_id);
    return venueId == null || venueId === session.venue_id;
  }

  return true;
}

export const LIVE_SESSION_REALTIME_TABLES = [
  "session_players",
  "matches",
  "sessions",
  "bookings",
  "coaching_bookings",
] as const;
