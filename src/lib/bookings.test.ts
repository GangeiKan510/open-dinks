import { describe, expect, it } from "vitest";
import {
  BOOKING_ERROR_MESSAGES,
  BOOKING_HISTORY_LOOKBACK_MS,
  formatDateAndTimeRange,
  formatPaymentStatus,
  formatPriceCents,
  formatTimeRange,
  isBookingHistoryRow,
  parseBookingTime,
  parseBookingRequestStatus,
  parsePaymentStatus,
  parsePriceToCents,
  parsePublicBookingVenue,
  rangesOverlap,
  sessionBookingWindow,
  validateBookingWindow,
  venueBookingHistoryFrom,
} from "./bookings";

const NOON = new Date("2026-08-29T12:00:00Z").getTime();
const HOUR = 60 * 60 * 1000;

describe("parseBookingTime", () => {
  it("parses a datetime-local value", () => {
    expect(parseBookingTime("2026-08-29T12:00")).toBe(
      new Date("2026-08-29T12:00").getTime(),
    );
  });

  it("parses an ISO timestamp from a hidden slot field", () => {
    expect(parseBookingTime("2026-09-01T08:00:00.000Z")).toBe(
      new Date("2026-09-01T08:00:00.000Z").getTime(),
    );
  });

  it("rejects blank, non-string, and unparseable values", () => {
    expect(parseBookingTime("")).toBeNull();
    expect(parseBookingTime("   ")).toBeNull();
    expect(parseBookingTime(null)).toBeNull();
    expect(parseBookingTime(42)).toBeNull();
    expect(parseBookingTime("not a date")).toBeNull();
  });
});

describe("parsePriceToCents", () => {
  it("converts pesos to integer centavos", () => {
    expect(parsePriceToCents("25")).toBe(2500);
    expect(parsePriceToCents("25.50")).toBe(2550);
  });

  it("rounds sub-cent input rather than truncating", () => {
    expect(parsePriceToCents("10.005")).toBe(1001);
  });

  it("treats blank and missing as no price", () => {
    expect(parsePriceToCents("")).toBeNull();
    expect(parsePriceToCents("  ")).toBeNull();
    expect(parsePriceToCents(null)).toBeNull();
    expect(parsePriceToCents(undefined)).toBeNull();
  });

  it("flags negative and non-numeric input", () => {
    expect(parsePriceToCents("-5")).toBe("invalid");
    expect(parsePriceToCents("free")).toBe("invalid");
  });
});

describe("formatPriceCents", () => {
  it("renders cents as pesos without double-converting", () => {
    expect(formatPriceCents(2500)).toBe("₱25.00");
    expect(formatPriceCents(45)).toBe("₱0.45");
    expect(formatPriceCents(0)).toBe("₱0.00");
  });

  it("renders an em dash when no price is set", () => {
    expect(formatPriceCents(null)).toBe("—");
    expect(formatPriceCents(undefined)).toBe("—");
  });
});

describe("parsePaymentStatus", () => {
  it("accepts unpaid and paid", () => {
    expect(parsePaymentStatus("unpaid")).toBe("unpaid");
    expect(parsePaymentStatus("paid")).toBe("paid");
  });

  it("rejects empty or unknown values", () => {
    expect(parsePaymentStatus("")).toBe("invalid");
    expect(parsePaymentStatus("refunded")).toBe("invalid");
  });
});

describe("formatPaymentStatus", () => {
  it("labels payment status for the UI", () => {
    expect(formatPaymentStatus("paid")).toBe("Paid");
    expect(formatPaymentStatus("unpaid")).toBe("Unpaid");
    expect(formatPaymentStatus("refunded")).toBe("Refunded");
  });
});

describe("validateBookingWindow", () => {
  it("accepts a normal future booking", () => {
    expect(validateBookingWindow(NOON, NOON + HOUR, NOON - HOUR)).toBeNull();
  });

  it("rejects an end at or before the start", () => {
    expect(validateBookingWindow(NOON, NOON, NOON - HOUR)).toBe(
      BOOKING_ERROR_MESSAGES.order,
    );
    expect(validateBookingWindow(NOON, NOON - HOUR, NOON - 2 * HOUR)).toBe(
      BOOKING_ERROR_MESSAGES.order,
    );
  });

  it("rejects a booking that has already finished", () => {
    expect(validateBookingWindow(NOON - 2 * HOUR, NOON - HOUR, NOON)).toBe(
      BOOKING_ERROR_MESSAGES.past,
    );
  });

  it("allows a booking already in progress", () => {
    expect(validateBookingWindow(NOON - HOUR, NOON + HOUR, NOON)).toBeNull();
  });

  it("rejects a booking longer than 12 hours", () => {
    expect(validateBookingWindow(NOON, NOON + 13 * HOUR, NOON)).toBe(
      BOOKING_ERROR_MESSAGES.tooLong,
    );
  });
});

describe("rangesOverlap", () => {
  it("treats touching ranges as non-overlapping", () => {
    expect(rangesOverlap(NOON, NOON + HOUR, NOON + HOUR, NOON + 2 * HOUR)).toBe(
      false,
    );
  });

  it("detects partial and full containment", () => {
    expect(
      rangesOverlap(NOON, NOON + 2 * HOUR, NOON + HOUR, NOON + 3 * HOUR),
    ).toBe(true);
    expect(
      rangesOverlap(NOON, NOON + 3 * HOUR, NOON + HOUR, NOON + 2 * HOUR),
    ).toBe(true);
  });
});

describe("formatTimeRange / formatDateAndTimeRange", () => {
  const opts = { locale: "en-US", timeZone: "UTC" };

  it("renders a start–end clock range", () => {
    expect(formatTimeRange(NOON, NOON + 90 * 60 * 1000, opts)).toBe(
      "12:00 PM – 1:30 PM",
    );
  });

  it("prefixes the weekday and date for list rows", () => {
    expect(formatDateAndTimeRange(NOON, NOON + HOUR, opts)).toBe(
      "Sat, Aug 29 · 12:00 PM – 1:00 PM",
    );
  });
});

describe("parsePublicBookingVenue", () => {
  const venue = {
    id: "venue-1",
    name: "Riverside Courts",
    slug: "riverside-courts",
    timezone: "America/Chicago",
    bookingOpenHour: 6,
    bookingCloseHour: 22,
    courts: [
      { id: "court-1", name: "Court 1" },
      { id: "court-2", name: "Court 2" },
    ],
  };

  it("parses the RPC payload", () => {
    expect(parsePublicBookingVenue(venue)).toEqual(venue);
  });

  it("defaults booking hours when the RPC omits them", () => {
    const withoutHours: Record<string, unknown> = { ...venue };
    delete withoutHours.bookingOpenHour;
    delete withoutHours.bookingCloseHour;
    const parsed = parsePublicBookingVenue(withoutHours);
    expect(parsed?.bookingOpenHour).toBe(6);
    expect(parsed?.bookingCloseHour).toBe(22);
  });

  it("returns null when the venue is missing or malformed", () => {
    expect(parsePublicBookingVenue(null)).toBeNull();
    expect(parsePublicBookingVenue([])).toBeNull();
    expect(parsePublicBookingVenue("nope")).toBeNull();
    expect(parsePublicBookingVenue({ ...venue, id: 7 })).toBeNull();
    expect(parsePublicBookingVenue({ ...venue, slug: undefined })).toBeNull();
  });

  it("defaults a missing timezone rather than failing the page", () => {
    const withoutZone: Record<string, unknown> = { ...venue };
    delete withoutZone.timezone;
    expect(parsePublicBookingVenue(withoutZone)?.timezone).toBe("UTC");
  });

  it("skips malformed court entries and tolerates a missing courts array", () => {
    const parsed = parsePublicBookingVenue({
      ...venue,
      courts: [{ id: "court-1", name: "Court 1" }, { id: "court-2" }, null],
    });
    expect(parsed?.courts).toEqual([{ id: "court-1", name: "Court 1" }]);

    const withoutCourts: Record<string, unknown> = { ...venue };
    delete withoutCourts.courts;
    expect(parsePublicBookingVenue(withoutCourts)?.courts).toEqual([]);
  });
});

describe("parseBookingRequestStatus", () => {
  it("parses the RPC payload", () => {
    const parsed = parseBookingRequestStatus({
      status: "cancelled",
      declineReason: "Court reserved for a clinic",
      bookedByName: "Alex",
      startsAt: "2026-09-01T09:00:00Z",
      endsAt: "2026-09-01T10:00:00Z",
      venueName: "Riverside",
      venueSlug: "riverside",
      venueTimezone: "UTC",
      courtName: "Court 1",
    });
    expect(parsed?.declineReason).toBe("Court reserved for a clinic");
  });

  it("returns null for malformed payloads", () => {
    expect(parseBookingRequestStatus(null)).toBeNull();
    expect(parseBookingRequestStatus({ status: "unknown" })).toBeNull();
  });
});

describe("sessionBookingWindow", () => {
  it("brackets now with a lookback and a lookahead", () => {
    const { from, to } = sessionBookingWindow(NOON);
    expect(new Date(from).getTime()).toBeLessThan(NOON);
    expect(new Date(to).getTime()).toBeGreaterThan(NOON);
  });
});

describe("isBookingHistoryRow", () => {
  it("treats cancelled and ended bookings as history", () => {
    expect(
      isBookingHistoryRow(
        {
          status: "cancelled",
          ends_at: new Date(NOON + HOUR).toISOString(),
        },
        NOON,
      ),
    ).toBe(true);
    expect(
      isBookingHistoryRow(
        {
          status: "confirmed",
          ends_at: new Date(NOON - 1).toISOString(),
        },
        NOON,
      ),
    ).toBe(true);
    expect(
      isBookingHistoryRow(
        {
          status: "confirmed",
          ends_at: new Date(NOON + HOUR).toISOString(),
        },
        NOON,
      ),
    ).toBe(false);
  });
});

describe("venueBookingHistoryFrom", () => {
  it("looks back ninety days", () => {
    const from = new Date(venueBookingHistoryFrom(NOON)).getTime();
    expect(NOON - from).toBe(BOOKING_HISTORY_LOOKBACK_MS);
  });
});
