import {
  formatTimeRange,
  rangesOverlap,
  type PublicBookingCourt,
} from "@/lib/bookings";
import {
  bookingHourColumns,
  DEFAULT_BOOKING_CLOSE_HOUR,
  DEFAULT_BOOKING_OPEN_HOUR,
} from "@/lib/booking-hours";

export const PUBLIC_BOOKING_LOOKAHEAD_DAYS = 7;

/** Standard court rental length on the public booking page. */
export const BOOKING_SLOT_DURATION_MS = 60 * 60 * 1000;

/** @deprecated Use DEFAULT_BOOKING_OPEN_HOUR from `@/lib/booking-hours`. */
export const BOOKING_OPEN_HOUR = DEFAULT_BOOKING_OPEN_HOUR;

/** @deprecated Use DEFAULT_BOOKING_CLOSE_HOUR from `@/lib/booking-hours`. */
export const BOOKING_CLOSE_HOUR = DEFAULT_BOOKING_CLOSE_HOUR;

export type PublicBusyRangeInput = {
  court_id: string;
  starts_at: string;
  ends_at: string;
};

export type BookingBusyRow = {
  court_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
};

/** Maps venue booking rows into the shape `buildHourlySlotGrid` expects. */
export function busyRangesFromBookings(
  bookings: BookingBusyRow[],
  options?: { includePending?: boolean },
): PublicBusyRangeInput[] {
  return bookings
    .filter(
      (booking) =>
        booking.status === "confirmed" ||
        (options?.includePending && booking.status === "pending"),
    )
    .map(({ court_id, starts_at, ends_at }) => ({
      court_id,
      starts_at,
      ends_at,
    }));
}

export type ConfirmedBooking = {
  courtId: string;
  startsAt: number;
  endsAt: number;
};

export type BookingCalendarDay = {
  key: string;
  weekday: string;
  dateLabel: string;
};

export type SlotAvailability = "available" | "booked" | "past";

export type HourlyBookableSlot = {
  courtId: string;
  courtName: string;
  dayKey: string;
  hour: number;
  startsAt: number;
  endsAt: number;
  status: SlotAvailability;
};

export type HourlySlotGrid = {
  days: BookingCalendarDay[];
  hours: number[];
  slots: HourlyBookableSlot[];
};

/** `YYYY-MM-DD` for a timestamp in the venue timezone. */
export function dayKeyInTimeZone(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

/** Next N calendar days starting from `fromMs`, in venue local time. */
export function upcomingDayKeys(
  fromMs: number,
  dayCount: number,
  timeZone: string,
): string[] {
  const keys: string[] = [];
  let probe = fromMs;

  while (keys.length < dayCount) {
    const key = dayKeyInTimeZone(probe, timeZone);
    if (keys[keys.length - 1] !== key) {
      keys.push(key);
    }
    probe += 60 * 60 * 1000;
    if (probe - fromMs > dayCount * 48 * 60 * 60 * 1000) break;
  }

  return keys;
}

export function formatCalendarDay(
  dayKey: string,
  timeZone: string,
  locale = "en-US",
): Pick<BookingCalendarDay, "weekday" | "dateLabel"> {
  const noon = Date.parse(`${dayKey}T12:00:00Z`);
  const weekday = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "short",
  }).format(noon);
  const dateLabel = new Intl.DateTimeFormat(locale, {
    timeZone,
    month: "short",
    day: "numeric",
  }).format(noon);
  return { weekday, dateLabel };
}

export function bookingHours(
  openHour = DEFAULT_BOOKING_OPEN_HOUR,
  closeHour = DEFAULT_BOOKING_CLOSE_HOUR,
): number[] {
  return bookingHourColumns(openHour, closeHour);
}

export function getZonedParts(
  ms: number,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ms));

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);

  const hour = pick("hour");
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: hour === 24 ? 0 : hour,
    minute: pick("minute"),
  };
}

/** UTC instant for a wall-clock hour on a calendar day in the venue timezone. */
export function zonedSlotToUtc(
  dayKey: string,
  hour: number,
  timeZone: string,
): number {
  const [year, month, day] = dayKey.split("-").map(Number);
  let utc = Date.UTC(year, month - 1, day, hour, 0, 0, 0);

  for (let i = 0; i < 6; i++) {
    const zoned = getZonedParts(utc, timeZone);
    if (
      zoned.year === year &&
      zoned.month === month &&
      zoned.day === day &&
      zoned.hour === hour &&
      zoned.minute === 0
    ) {
      return utc;
    }

    const desired = Date.UTC(year, month - 1, day, hour, 0);
    const actual = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
    );
    utc += desired - actual;
  }

  return utc;
}

export function parseConfirmedBookings(
  ranges: PublicBusyRangeInput[],
): ConfirmedBooking[] {
  const bookings: ConfirmedBooking[] = [];
  for (const range of ranges) {
    const startsAt = new Date(range.starts_at).getTime();
    const endsAt = new Date(range.ends_at).getTime();
    if (Number.isNaN(startsAt) || Number.isNaN(endsAt) || endsAt <= startsAt) {
      continue;
    }
    bookings.push({ courtId: range.court_id, startsAt, endsAt });
  }
  return bookings;
}

export function slotStatus(
  startsAt: number,
  endsAt: number,
  courtBookings: ConfirmedBooking[],
  now: number,
): SlotAvailability {
  if (endsAt <= now) return "past";
  if (
    courtBookings.some((booking) =>
      rangesOverlap(startsAt, endsAt, booking.startsAt, booking.endsAt),
    )
  ) {
    return "booked";
  }
  return "available";
}

/**
 * Hourly 1-hour rental slots for each court and day. Booked slots follow
 * confirmed reservations; past slots cannot be selected.
 */
export function buildHourlySlotGrid(
  courts: PublicBookingCourt[],
  ranges: PublicBusyRangeInput[],
  options: {
    fromMs: number;
    dayCount?: number;
    timeZone: string;
    locale?: string;
    now?: number;
    openHour?: number;
    closeHour?: number;
  },
): HourlySlotGrid {
  const dayCount = options.dayCount ?? PUBLIC_BOOKING_LOOKAHEAD_DAYS;
  const timeZone = options.timeZone;
  const locale = options.locale ?? "en-US";
  const now = options.now ?? options.fromMs;
  const hours = bookingHours(options.openHour, options.closeHour);
  const dayKeys = upcomingDayKeys(options.fromMs, dayCount, timeZone);

  const days: BookingCalendarDay[] = dayKeys.map((key) => ({
    key,
    ...formatCalendarDay(key, timeZone, locale),
  }));

  const bookings = parseConfirmedBookings(ranges);
  const bookingsByCourt = new Map<string, ConfirmedBooking[]>();
  for (const court of courts) {
    bookingsByCourt.set(court.id, []);
  }
  for (const booking of bookings) {
    bookingsByCourt.get(booking.courtId)?.push(booking);
  }

  const slots: HourlyBookableSlot[] = [];

  for (const court of courts) {
    const courtBookings = bookingsByCourt.get(court.id) ?? [];
    for (const dayKey of dayKeys) {
      for (const hour of hours) {
        const startsAt = zonedSlotToUtc(dayKey, hour, timeZone);
        const endsAt = startsAt + BOOKING_SLOT_DURATION_MS;
        slots.push({
          courtId: court.id,
          courtName: court.name,
          dayKey,
          hour,
          startsAt,
          endsAt,
          status: slotStatus(startsAt, endsAt, courtBookings, now),
        });
      }
    }
  }

  return { days, hours, slots };
}

export function slotsForDay(
  grid: HourlySlotGrid,
  dayKey: string,
): HourlyBookableSlot[] {
  return grid.slots.filter((slot) => slot.dayKey === dayKey);
}

export function formatHourLabel(
  hour: number,
  options?: { locale?: string; timeZone?: string },
): string {
  const locale = options?.locale ?? "en-US";
  const timeZone = options?.timeZone ?? "UTC";
  const startsAt = zonedSlotToUtc("2026-01-01", hour, timeZone);
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(startsAt);
}

/** Column header: the full 1-hour window, e.g. "8:00 – 9:00 AM". */
export function formatSlotRangeLabel(
  dayKey: string,
  hour: number,
  timeZone: string,
  locale = "en-US",
): string {
  const startsAt = zonedSlotToUtc(dayKey, hour, timeZone);
  const endsAt = startsAt + BOOKING_SLOT_DURATION_MS;
  return formatTimeRange(startsAt, endsAt, { locale, timeZone });
}

/** @deprecated Prefer formatSlotRangeLabel — single-letter am/pm is easy to misread. */
export function formatCompactHourLabel(
  hour: number,
  options?: { timeZone?: string },
): string {
  const timeZone = options?.timeZone ?? "UTC";
  const startsAt = zonedSlotToUtc("2026-01-01", hour, timeZone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: true,
  }).formatToParts(startsAt);
  const h = parts.find((p) => p.type === "hour")?.value ?? String(hour);
  const period = (parts.find((p) => p.type === "dayPeriod")?.value ?? "AM")
    .charAt(0)
    .toLowerCase();
  return `${h}${period}`;
}

export type SelectedBookingRange = {
  courtId: string;
  courtName: string;
  dayKey: string;
  hours: number[];
  startsAt: number;
  endsAt: number;
};

export function isConsecutiveHours(hours: number[]): boolean {
  if (hours.length === 0) return false;
  const sorted = [...hours].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1]! + 1) return false;
  }
  return true;
}

export function buildSelectedRange(
  courtId: string,
  courtName: string,
  dayKey: string,
  hours: number[],
  slotByCourtHour: Map<string, HourlyBookableSlot>,
): SelectedBookingRange | null {
  const sorted = [...hours].sort((a, b) => a - b);
  if (!isConsecutiveHours(sorted)) return null;

  const first = slotByCourtHour.get(`${courtId}:${sorted[0]}`);
  const last = slotByCourtHour.get(`${courtId}:${sorted[sorted.length - 1]}`);
  if (!first || !last) return null;

  return {
    courtId,
    courtName,
    dayKey,
    hours: sorted,
    startsAt: first.startsAt,
    endsAt: last.endsAt,
  };
}

/**
 * Extends or shrinks a consecutive hour selection on one court/day. Tapping a
 * non-adjacent open hour starts a new block — gaps require a separate booking.
 */
export function toggleConsecutiveSelection(
  current: SelectedBookingRange | null,
  slot: HourlyBookableSlot,
  slotByCourtHour: Map<string, HourlyBookableSlot>,
): SelectedBookingRange | null {
  if (slot.status !== "available") return current;

  if (
    !current ||
    current.courtId !== slot.courtId ||
    current.dayKey !== slot.dayKey
  ) {
    return buildSelectedRange(
      slot.courtId,
      slot.courtName,
      slot.dayKey,
      [slot.hour],
      slotByCourtHour,
    );
  }

  const hours = [...current.hours].sort((a, b) => a - b);
  const min = hours[0]!;
  const max = hours[hours.length - 1]!;

  if (hours.includes(slot.hour)) {
    if (hours.length === 1) return null;
    if (slot.hour === min) {
      return buildSelectedRange(
        current.courtId,
        current.courtName,
        current.dayKey,
        hours.slice(1),
        slotByCourtHour,
      );
    }
    if (slot.hour === max) {
      return buildSelectedRange(
        current.courtId,
        current.courtName,
        current.dayKey,
        hours.slice(0, -1),
        slotByCourtHour,
      );
    }
    return buildSelectedRange(
      slot.courtId,
      slot.courtName,
      slot.dayKey,
      [slot.hour],
      slotByCourtHour,
    );
  }

  if (slot.hour === min - 1 || slot.hour === max + 1) {
    return buildSelectedRange(
      current.courtId,
      current.courtName,
      current.dayKey,
      [...hours, slot.hour],
      slotByCourtHour,
    );
  }

  return buildSelectedRange(
    slot.courtId,
    slot.courtName,
    slot.dayKey,
    [slot.hour],
    slotByCourtHour,
  );
}

export function validatePublicBookingDuration(
  startsAt: number,
  endsAt: number,
): boolean {
  const duration = endsAt - startsAt;
  return (
    duration >= BOOKING_SLOT_DURATION_MS &&
    duration % BOOKING_SLOT_DURATION_MS === 0
  );
}

export type ScheduleBooking = {
  id: string;
  courtId: string;
  startsAt: number;
  endsAt: number;
  status: "pending" | "confirmed";
  bookedByName: string;
};

export function parseScheduleBookings(
  rows: Array<{
    id: string;
    court_id: string;
    starts_at: string;
    ends_at: string;
    status: string;
    booked_by_name: string;
  }>,
): ScheduleBooking[] {
  const parsed: ScheduleBooking[] = [];
  for (const row of rows) {
    if (row.status !== "pending" && row.status !== "confirmed") continue;
    const startsAt = new Date(row.starts_at).getTime();
    const endsAt = new Date(row.ends_at).getTime();
    if (Number.isNaN(startsAt) || Number.isNaN(endsAt) || endsAt <= startsAt) {
      continue;
    }
    parsed.push({
      id: row.id,
      courtId: row.court_id,
      startsAt,
      endsAt,
      status: row.status,
      bookedByName: row.booked_by_name,
    });
  }
  return parsed;
}

export function bookingsCoveringSlot(
  bookings: ScheduleBooking[],
  courtId: string,
  slotStartsAt: number,
  slotEndsAt: number,
): ScheduleBooking[] {
  return bookings.filter(
    (booking) =>
      booking.courtId === courtId &&
      rangesOverlap(slotStartsAt, slotEndsAt, booking.startsAt, booking.endsAt),
  );
}
