import { describe, expect, it } from "vitest";
import {
  bookingsFromPublicBusyRanges,
  isBookingReadDenied,
  PUBLIC_COURT_HOLD_LABEL,
} from "./public-session-holds";

describe("bookingsFromPublicBusyRanges", () => {
  it("keeps the court and the window, and leaves contact fields empty", () => {
    const [hold] = bookingsFromPublicBusyRanges("venue-1", [
      {
        court_id: "court-1",
        starts_at: "2026-11-19T02:00:00.000Z",
        ends_at: "2026-11-19T03:00:00.000Z",
      },
    ]);

    expect(hold?.venue_id).toBe("venue-1");
    expect(hold?.court_id).toBe("court-1");
    expect(hold?.starts_at).toBe("2026-11-19T02:00:00.000Z");
    expect(hold?.ends_at).toBe("2026-11-19T03:00:00.000Z");
    expect(hold?.status).toBe("confirmed");
    expect(hold?.booked_by_name).toBe(PUBLIC_COURT_HOLD_LABEL);
    expect(hold?.contact_email).toBeNull();
    expect(hold?.contact_phone).toBeNull();
    expect(hold?.notes).toBeNull();
    expect(hold?.price_cents).toBeNull();
  });
});

describe("isBookingReadDenied", () => {
  it("matches a missing grant and ignores other failures", () => {
    expect(isBookingReadDenied({ code: "42501" })).toBe(true);
    expect(
      isBookingReadDenied({ message: "permission denied for table bookings" }),
    ).toBe(true);
    expect(isBookingReadDenied({ code: "57014", message: "timeout" })).toBe(
      false,
    );
  });
});
