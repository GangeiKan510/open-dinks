import { describe, expect, it } from "vitest";
import {
  BOOKING_SLOT_DURATION_MS,
  bookingsCoveringSlot,
  buildHourlySlotGrid,
  busyRangesFromBookings,
  dayKeyInTimeZone,
  parseScheduleBookings,
  formatHourLabel,
  formatSlotRangeLabel,
  isConsecutiveHours,
  slotStatus,
  slotsForDay,
  toggleConsecutiveSelection,
  upcomingDayKeys,
  validatePublicBookingDuration,
  zonedSlotToUtc,
  type HourlyBookableSlot,
} from "@/lib/booking-calendar";
import { rangesOverlap } from "@/lib/bookings";

const courts = [
  { id: "c1", name: "Court 1" },
  { id: "c2", name: "Court 2" },
];

describe("zonedSlotToUtc", () => {
  it("maps a UTC wall time directly in UTC", () => {
    const ms = zonedSlotToUtc("2026-09-01", 8, "UTC");
    expect(new Date(ms).toISOString()).toBe("2026-09-01T08:00:00.000Z");
  });
});

describe("parseScheduleBookings", () => {
  it("keeps pending and confirmed rows with valid times", () => {
    const parsed = parseScheduleBookings([
      {
        id: "b1",
        court_id: "c1",
        starts_at: "2026-09-01T09:00:00Z",
        ends_at: "2026-09-01T10:00:00Z",
        status: "pending",
        booked_by_name: "Alex",
      },
      {
        id: "b2",
        court_id: "c1",
        starts_at: "2026-09-01T11:00:00Z",
        ends_at: "2026-09-01T12:00:00Z",
        status: "confirmed",
        booked_by_name: "Blake",
      },
      {
        id: "b3",
        court_id: "c1",
        starts_at: "2026-09-01T13:00:00Z",
        ends_at: "2026-09-01T14:00:00Z",
        status: "cancelled",
        booked_by_name: "Casey",
      },
    ]);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.status).toBe("pending");
  });
});

describe("bookingsCoveringSlot", () => {
  it("returns bookings overlapping the hourly slot", () => {
    const bookings = parseScheduleBookings([
      {
        id: "b1",
        court_id: "c1",
        starts_at: "2026-09-01T09:00:00Z",
        ends_at: "2026-09-01T11:00:00Z",
        status: "confirmed",
        booked_by_name: "Alex",
      },
    ]);
    const slotStart = new Date("2026-09-01T09:00:00Z").getTime();
    const slotEnd = slotStart + BOOKING_SLOT_DURATION_MS;

    expect(
      bookingsCoveringSlot(bookings, "c1", slotStart, slotEnd),
    ).toHaveLength(1);
    expect(
      bookingsCoveringSlot(
        bookings,
        "c1",
        slotStart + 2 * BOOKING_SLOT_DURATION_MS,
        slotEnd + 2 * BOOKING_SLOT_DURATION_MS,
      ),
    ).toHaveLength(0);
  });
});

describe("busyRangesFromBookings", () => {
  it("includes confirmed bookings and optionally pending", () => {
    const rows = [
      {
        court_id: "c1",
        starts_at: "2026-09-01T09:00:00Z",
        ends_at: "2026-09-01T10:00:00Z",
        status: "confirmed",
      },
      {
        court_id: "c2",
        starts_at: "2026-09-01T11:00:00Z",
        ends_at: "2026-09-01T12:00:00Z",
        status: "pending",
      },
      {
        court_id: "c1",
        starts_at: "2026-09-01T13:00:00Z",
        ends_at: "2026-09-01T14:00:00Z",
        status: "cancelled",
      },
    ];

    expect(busyRangesFromBookings(rows)).toHaveLength(1);
    expect(busyRangesFromBookings(rows, { includePending: true })).toHaveLength(
      2,
    );
  });
});

describe("buildHourlySlotGrid", () => {
  const fromMs = new Date("2026-09-01T00:00:00Z").getTime();

  it("creates one-hour slots for each court, day, and operating hour", () => {
    const grid = buildHourlySlotGrid(courts, [], {
      fromMs,
      dayCount: 2,
      timeZone: "UTC",
      openHour: 8,
      closeHour: 10,
      now: fromMs,
    });

    expect(grid.hours).toEqual([8, 9]);
    expect(grid.days).toHaveLength(2);
    expect(grid.slots).toHaveLength(2 * 2 * 2);
    expect(grid.slots[0]?.endsAt).toBe(
      grid.slots[0]!.startsAt + BOOKING_SLOT_DURATION_MS,
    );
  });

  it("marks overlapping confirmed bookings as booked", () => {
    const grid = buildHourlySlotGrid(
      [courts[0]!],
      [
        {
          court_id: "c1",
          starts_at: "2026-09-01T09:00:00Z",
          ends_at: "2026-09-01T10:00:00Z",
        },
      ],
      {
        fromMs,
        dayCount: 1,
        timeZone: "UTC",
        openHour: 8,
        closeHour: 11,
        now: fromMs,
      },
    );

    const daySlots = slotsForDay(grid, "2026-09-01");
    expect(daySlots.find((s) => s.hour === 8)?.status).toBe("available");
    expect(daySlots.find((s) => s.hour === 9)?.status).toBe("booked");
    expect(daySlots.find((s) => s.hour === 10)?.status).toBe("available");
  });

  it("marks slots that already ended as past", () => {
    const now = new Date("2026-09-01T12:00:00Z").getTime();
    const status = slotStatus(
      new Date("2026-09-01T08:00:00Z").getTime(),
      new Date("2026-09-01T09:00:00Z").getTime(),
      [],
      now,
    );
    expect(status).toBe("past");
  });
});

describe("dayKeyInTimeZone", () => {
  it("returns a YYYY-MM-DD key", () => {
    const ms = new Date("2026-09-01T04:00:00Z").getTime();
    expect(dayKeyInTimeZone(ms, "UTC")).toBe("2026-09-01");
  });
});

describe("upcomingDayKeys", () => {
  it("returns consecutive day keys", () => {
    const from = new Date("2026-09-01T12:00:00Z").getTime();
    expect(upcomingDayKeys(from, 3, "UTC")).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
    ]);
  });
});

describe("formatHourLabel", () => {
  it("formats an hour for display", () => {
    expect(formatHourLabel(8, { timeZone: "UTC" })).toMatch(/8/);
  });
});

describe("formatSlotRangeLabel", () => {
  it("shows the full one-hour window", () => {
    const label = formatSlotRangeLabel("2026-09-01", 8, "UTC");
    expect(label).toContain("–");
    expect(label).toMatch(/8/);
    expect(label).toMatch(/9/);
  });
});

describe("rangesOverlap", () => {
  it("detects overlapping half-open ranges", () => {
    const aStart = 0;
    const aEnd = 60;
    const bStart = 30;
    const bEnd = 90;
    expect(rangesOverlap(aStart, aEnd, bStart, bEnd)).toBe(true);
  });
});

function availableSlot(hour: number): HourlyBookableSlot {
  const startsAt = zonedSlotToUtc("2026-09-01", hour, "UTC");
  return {
    courtId: "c1",
    courtName: "Court 1",
    dayKey: "2026-09-01",
    hour,
    startsAt,
    endsAt: startsAt + BOOKING_SLOT_DURATION_MS,
    status: "available",
  };
}

function slotMap(...slots: HourlyBookableSlot[]) {
  const map = new Map<string, HourlyBookableSlot>();
  for (const slot of slots) {
    map.set(`${slot.courtId}:${slot.hour}`, slot);
  }
  return map;
}

describe("toggleConsecutiveSelection", () => {
  const map = () => slotMap(...[8, 9, 10, 11].map(availableSlot));

  it("starts with a single hour", () => {
    const next = toggleConsecutiveSelection(null, availableSlot(9), map());
    expect(next?.hours).toEqual([9]);
  });

  it("extends to an adjacent hour", () => {
    const first = toggleConsecutiveSelection(null, availableSlot(9), map());
    const next = toggleConsecutiveSelection(first, availableSlot(10), map());
    expect(next?.hours).toEqual([9, 10]);
    expect(isConsecutiveHours(next!.hours)).toBe(true);
  });

  it("replaces the block when tapping a non-adjacent hour", () => {
    const first = toggleConsecutiveSelection(null, availableSlot(10), map());
    const extended = toggleConsecutiveSelection(
      first,
      availableSlot(11),
      map(),
    );
    const next = toggleConsecutiveSelection(extended, availableSlot(8), map());
    expect(next?.hours).toEqual([8]);
  });

  it("deselects when tapping the only selected hour again", () => {
    const first = toggleConsecutiveSelection(null, availableSlot(9), map());
    const next = toggleConsecutiveSelection(first, availableSlot(9), map());
    expect(next).toBeNull();
  });
});

describe("validatePublicBookingDuration", () => {
  it("accepts one or more whole hours", () => {
    const start = 0;
    expect(
      validatePublicBookingDuration(start, start + BOOKING_SLOT_DURATION_MS),
    ).toBe(true);
    expect(
      validatePublicBookingDuration(
        start,
        start + 2 * BOOKING_SLOT_DURATION_MS,
      ),
    ).toBe(true);
  });

  it("rejects partial-hour durations", () => {
    const start = 0;
    expect(
      validatePublicBookingDuration(
        start,
        start + BOOKING_SLOT_DURATION_MS / 2,
      ),
    ).toBe(false);
  });
});
