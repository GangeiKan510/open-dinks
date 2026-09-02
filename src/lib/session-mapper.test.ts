import { describe, expect, it } from "vitest";
import { dbToEngineState } from "@/lib/session-mapper";
import type { Database } from "@/lib/supabase/database.types";

type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
type CourtRow = Database["public"]["Tables"]["courts"]["Row"];
type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];

const baseSession: SessionRow = {
  id: "session-1",
  venue_id: "venue-1",
  title: "Open Play",
  public_token: "abc123",
  mode: "rotating",
  status: "live",
  court_count: 1,
  king_max_consecutive_wins: 3,
  max_game_minutes: 15,
  started_at: null,
  ended_at: null,
  created_by: null,
  created_at: new Date().toISOString(),
};

describe("session mapper courts", () => {
  it("supports a single-court session", () => {
    const courts: CourtRow[] = [
      {
        id: "court-1",
        venue_id: "venue-1",
        name: "Court 1",
        sort_order: 1,
        skill_min: null,
        skill_max: null,
        created_at: new Date().toISOString(),
      },
    ];

    const state = dbToEngineState({
      session: baseSession,
      players: [],
      matches: [],
      courts,
      pairings: [],
    });

    expect(state.courts).toHaveLength(1);
    expect(state.courts[0].name).toBe("Court 1");
  });

  it("pads virtual courts when a session uses more courts than the venue has saved", () => {
    const courts: CourtRow[] = [
      {
        id: "court-1",
        venue_id: "venue-1",
        name: "Court 1",
        sort_order: 1,
        skill_min: null,
        skill_max: null,
        created_at: new Date().toISOString(),
      },
    ];

    const state = dbToEngineState({
      session: { ...baseSession, court_count: 4 },
      players: [],
      matches: [],
      courts,
      pairings: [],
    });

    expect(state.courts).toHaveLength(4);
    expect(state.courts.map((court) => court.name)).toEqual([
      "Court 1",
      "Court 2",
      "Court 3",
      "Court 4",
    ]);
  });
});

describe("session mapper bookings", () => {
  const court: CourtRow = {
    id: "court-1",
    venue_id: "venue-1",
    name: "Court 1",
    sort_order: 1,
    skill_min: null,
    skill_max: null,
    created_at: new Date().toISOString(),
  };

  function bookingRow(partial: Partial<BookingRow>): BookingRow {
    return {
      id: "booking-1",
      venue_id: "venue-1",
      court_id: "court-1",
      starts_at: "2026-08-29T12:00:00.000Z",
      ends_at: "2026-08-29T13:00:00.000Z",
      status: "confirmed",
      booked_by_name: "Rivera party",
      contact_email: null,
      contact_phone: null,
      notes: null,
      price_cents: null,
      payment_status: "unpaid",
      source: "staff",
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      public_token: "token-1",
      decline_reason: null,
      ...partial,
    };
  }

  it("attaches confirmed bookings to the matching court", () => {
    const state = dbToEngineState({
      session: baseSession,
      players: [],
      matches: [],
      courts: [court],
      pairings: [],
      bookings: [bookingRow({})],
    });

    expect(state.courts[0].bookings).toEqual([
      {
        id: "booking-1",
        label: "Rivera party",
        startsAt: Date.parse("2026-08-29T12:00:00.000Z"),
        endsAt: Date.parse("2026-08-29T13:00:00.000Z"),
      },
    ]);
  });

  it("ignores pending and cancelled rows so only reservations block play", () => {
    const state = dbToEngineState({
      session: baseSession,
      players: [],
      matches: [],
      courts: [court],
      pairings: [],
      bookings: [
        bookingRow({ id: "pending-1", status: "pending" }),
        bookingRow({ id: "cancelled-1", status: "cancelled" }),
      ],
    });

    expect(state.courts[0].bookings).toBeUndefined();
  });

  it("sorts a court's bookings by start time regardless of row order", () => {
    const state = dbToEngineState({
      session: baseSession,
      players: [],
      matches: [],
      courts: [court],
      pairings: [],
      bookings: [
        bookingRow({
          id: "later",
          starts_at: "2026-08-29T18:00:00.000Z",
          ends_at: "2026-08-29T19:00:00.000Z",
        }),
        bookingRow({ id: "earlier" }),
      ],
    });

    expect(state.courts[0].bookings?.map((b) => b.id)).toEqual([
      "earlier",
      "later",
    ]);
  });

  it("drops rows with an unparseable timestamp instead of emitting NaN bounds", () => {
    const state = dbToEngineState({
      session: baseSession,
      players: [],
      matches: [],
      courts: [court],
      pairings: [],
      bookings: [bookingRow({ starts_at: "not a date" })],
    });

    expect(state.courts[0].bookings).toBeUndefined();
  });

  it("leaves padded virtual courts unbookable", () => {
    const state = dbToEngineState({
      session: { ...baseSession, court_count: 2 },
      players: [],
      matches: [],
      courts: [court],
      pairings: [],
      bookings: [bookingRow({ court_id: "virtual_2" })],
    });

    expect(state.courts[1].id).toBe("virtual_2");
    expect(state.courts[1].bookings).toBeUndefined();
  });
});
