/**
 * How far around "now" a live session cares about bookings. Anything outside
 * this window cannot affect the current wallboard, so it is not fetched.
 */
import type { DbBookingStatus } from "@/lib/supabase/database.types";
import { normalizeBookingHours } from "@/lib/booking-hours";

const SESSION_BOOKING_LOOKBACK_MS = 6 * 60 * 60 * 1000;
const SESSION_BOOKING_LOOKAHEAD_MS = 24 * 60 * 60 * 1000;

export const BOOKING_ERROR_MESSAGES = {
  signIn: "Sign in to manage bookings.",
  venue: "Choose a venue before booking a court.",
  court: "Choose a court.",
  name: "Add the name this court is booked under.",
  time: "Enter a start and end time.",
  order: "The booking must end after it starts.",
  past: "Pick a time in the future.",
  tooLong: "Bookings cannot run longer than 12 hours.",
  duration:
    "Pick consecutive 1-hour slots on the calendar. Each booking must be one unbroken block.",
  declineReason:
    "Add a short reason so the requester knows why it was declined.",
  price: "Enter the price as a number, or leave it blank.",
  payment: "Choose unpaid or paid.",
  overlap: "That court is already booked for the selected time.",
  notFound: "That booking no longer exists.",
  save: "Could not save the booking. Try again.",
  migrations:
    "Bookings are not set up yet. Run the latest Supabase migrations, then try again.",
} as const;

/** Longest single booking we accept, as a guard against typo'd end dates. */
export const MAX_BOOKING_DURATION_MS = 12 * 60 * 60 * 1000;

/** How often a live session re-checks whether a booking window has opened. */
export const BOOKING_TICK_MS = 15 * 1000;

export function sessionBookingWindow(now: number = Date.now()): {
  from: string;
  to: string;
} {
  return {
    from: new Date(now - SESSION_BOOKING_LOOKBACK_MS).toISOString(),
    to: new Date(now + SESSION_BOOKING_LOOKAHEAD_MS).toISOString(),
  };
}

/**
 * Oldest booking the venue manager still lists as actionable. Bookings that
 * ended over an hour ago move to history.
 */
export function venueBookingsFrom(now: number = Date.now()): string {
  return new Date(now - 60 * 60 * 1000).toISOString();
}

/** How far back the Booking history tab looks. */
export const BOOKING_HISTORY_LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;

export function venueBookingHistoryFrom(now: number = Date.now()): string {
  return new Date(now - BOOKING_HISTORY_LOOKBACK_MS).toISOString();
}

/** Cancelled or already ended → history, not the live schedule. */
export function isBookingHistoryRow(
  booking: { status: string; ends_at: string },
  now: number = Date.now(),
): boolean {
  if (booking.status === "cancelled") return true;
  const endsAt = new Date(booking.ends_at).getTime();
  return Number.isFinite(endsAt) && endsAt <= now;
}

/**
 * Parses a `datetime-local` value (which carries no zone) into epoch ms.
 * Returns null for anything the browser or a hand-edited form could send.
 */
export function parseBookingTime(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

/** Major currency units from a price input → integer minor units. `""` means unset. */
export function parsePriceToCents(value: unknown): number | null | "invalid" {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0) return "invalid";
  return Math.round(amount * 100);
}

/** Minor units → peso display string. The DB column is centavos; only this converts it. */
export function formatPriceCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `₱${(cents / 100).toFixed(2)}`;
}

export type BookingPaymentStatusValue = "unpaid" | "paid";

export function parsePaymentStatus(
  value: unknown,
): BookingPaymentStatusValue | "invalid" {
  const raw = String(value ?? "").trim();
  if (raw === "unpaid" || raw === "paid") return raw;
  return "invalid";
}

export function formatPaymentStatus(status: string): string {
  if (status === "paid") return "Paid";
  if (status === "refunded") return "Refunded";
  return "Unpaid";
}

export function validateBookingWindow(
  startsAt: number,
  endsAt: number,
  now: number = Date.now(),
): string | null {
  if (endsAt <= startsAt) return BOOKING_ERROR_MESSAGES.order;
  if (endsAt <= now) return BOOKING_ERROR_MESSAGES.past;
  if (endsAt - startsAt > MAX_BOOKING_DURATION_MS) {
    return BOOKING_ERROR_MESSAGES.tooLong;
  }
  return null;
}

/**
 * "6:00 – 7:30 PM" style label for a booking window.
 * `timeZone` is only passed by tests; at runtime the browser zone is used, so
 * this must be rendered after mount to avoid a server/client hydration gap.
 */
export function formatTimeRange(
  startsAt: number,
  endsAt: number,
  options?: { locale?: string; timeZone?: string },
): string {
  const format = new Intl.DateTimeFormat(options?.locale ?? "en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: options?.timeZone,
  });
  return `${format.format(startsAt)} – ${format.format(endsAt)}`;
}

/**
 * "Sat, Aug 29 · 6:00 – 7:30 PM" for booking lists.
 * Same hydration caveat as `formatTimeRange`.
 */
export function formatDateAndTimeRange(
  startsAt: number,
  endsAt: number,
  options?: { locale?: string; timeZone?: string },
): string {
  const locale = options?.locale ?? "en-US";
  const day = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: options?.timeZone,
  }).format(startsAt);
  return `${day} · ${formatTimeRange(startsAt, endsAt, options)}`;
}

export type PublicBookingCourt = { id: string; name: string };

export type PublicBookingVenue = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  bookingOpenHour: number;
  bookingCloseHour: number;
  courts: PublicBookingCourt[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Narrows the jsonb payload from `get_public_booking_venue`.
 * Returns null for a missing venue so the page can 404 rather than render
 * a half-populated form.
 */
export function parsePublicBookingVenue(
  value: unknown,
): PublicBookingVenue | null {
  if (!isRecord(value)) return null;
  const {
    id,
    name,
    slug,
    timezone,
    bookingOpenHour,
    bookingCloseHour,
    courts,
  } = value;
  if (typeof id !== "string" || typeof name !== "string") return null;
  if (typeof slug !== "string") return null;

  const hours = normalizeBookingHours({
    openHour: typeof bookingOpenHour === "number" ? bookingOpenHour : undefined,
    closeHour:
      typeof bookingCloseHour === "number" ? bookingCloseHour : undefined,
  });

  const parsedCourts: PublicBookingCourt[] = [];
  if (Array.isArray(courts)) {
    for (const court of courts) {
      if (!isRecord(court)) continue;
      if (typeof court.id !== "string" || typeof court.name !== "string") {
        continue;
      }
      parsedCourts.push({ id: court.id, name: court.name });
    }
  }

  return {
    id,
    name,
    slug,
    timezone: typeof timezone === "string" ? timezone : "UTC",
    bookingOpenHour: hours.openHour,
    bookingCloseHour: hours.closeHour,
    courts: parsedCourts,
  };
}

/** True when two half-open [start, end) ranges overlap. */
export function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export type BookingRequestStatus = {
  status: DbBookingStatus;
  declineReason: string | null;
  bookedByName: string;
  startsAt: string;
  endsAt: string;
  venueName: string;
  venueSlug: string;
  venueTimezone: string;
  courtName: string;
};

/** Narrows the jsonb payload from `get_booking_request_status`. */
export function parseBookingRequestStatus(
  value: unknown,
): BookingRequestStatus | null {
  if (!isRecord(value)) return null;
  const {
    status,
    declineReason,
    bookedByName,
    startsAt,
    endsAt,
    venueName,
    venueSlug,
    venueTimezone,
    courtName,
  } = value;
  if (
    status !== "pending" &&
    status !== "confirmed" &&
    status !== "cancelled"
  ) {
    return null;
  }
  if (typeof bookedByName !== "string" || typeof startsAt !== "string") {
    return null;
  }
  if (typeof endsAt !== "string" || typeof venueName !== "string") {
    return null;
  }
  if (typeof venueSlug !== "string" || typeof courtName !== "string") {
    return null;
  }

  return {
    status,
    declineReason: typeof declineReason === "string" ? declineReason : null,
    bookedByName,
    startsAt,
    endsAt,
    venueName,
    venueSlug,
    venueTimezone: typeof venueTimezone === "string" ? venueTimezone : "UTC",
    courtName,
  };
}
