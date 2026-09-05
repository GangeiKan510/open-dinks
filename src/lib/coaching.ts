import {
  BOOKING_SLOT_DURATION_MS,
  PUBLIC_BOOKING_LOOKAHEAD_DAYS,
  formatCalendarDay,
  slotStatus,
  upcomingDayKeys,
  zonedSlotToUtc,
  type HourlyBookableSlot,
  type HourlySlotGrid,
} from "@/lib/booking-calendar";
import { bookingHourColumns } from "@/lib/booking-hours";
import { parsePriceToCents } from "@/lib/bookings";

export const COACHING_ERROR_MESSAGES = {
  signIn: "Sign in to manage coaching.",
  venue: "Choose a venue before managing coaches.",
  coach: "Choose a coach.",
  court: "Choose a court for this coaching session.",
  name: "Add the coach's name.",
  rate: "Enter the hourly rate as a number.",
  availability: "Select at least one day and hours with closing after opening.",
  day: "Pick a valid day of the week.",
  hours: "Choose valid start and end hours.",
  client: "Add the name this session is booked under.",
  time: "Enter a start and end time.",
  order: "The session must end after it starts.",
  past: "Pick a time in the future.",
  duration:
    "Pick consecutive 1-hour slots. Each coaching session must be one unbroken block.",
  outside: "That time is outside this coach's availability.",
  overlap: "That coach or court is already booked for the selected time.",
  courtBusy: "That court is already booked for the selected time.",
  notFound: "That coach or session no longer exists.",
  save: "Could not save. Try again.",
  migrations:
    "Coaching is not set up yet. Run the latest Supabase migrations, then try again.",
} as const;

export type CoachAvailabilityWindow = {
  dayOfWeek: number;
  startHour: number;
  endHour: number;
};

export type CoachWithAvailability = {
  id: string;
  name: string;
  rateCents: number;
  active: boolean;
  notes: string | null;
  availability: CoachAvailabilityWindow[];
};

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Sunday=0 … Saturday=6 for a calendar day key in the venue timezone. */
export function weekdayIndexForDayKey(
  dayKey: string,
  timeZone: string,
): number {
  const noonUtc = zonedSlotToUtc(dayKey, 12, timeZone);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(new Date(noonUtc));
  const index = WEEKDAY_TO_INDEX[weekday];
  if (index == null) {
    throw new Error(`Unexpected weekday label: ${weekday}`);
  }
  return index;
}

export function validateAvailabilityWindow(
  dayOfWeek: number,
  startHour: number,
  endHour: number,
): boolean {
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return false;
  }
  if (!Number.isInteger(startHour) || startHour < 0 || startHour > 23) {
    return false;
  }
  if (!Number.isInteger(endHour) || endHour < 1 || endHour > 24) {
    return false;
  }
  return endHour > startHour;
}

/** Same hours on several weekdays collapse into one editor row. */
export type AvailabilityWindowGroup = {
  days: number[];
  startHour: number;
  endHour: number;
};

export function groupAvailabilityByHours(
  windows: CoachAvailabilityWindow[],
): AvailabilityWindowGroup[] {
  const groups = new Map<string, AvailabilityWindowGroup>();
  for (const window of windows) {
    const key = `${window.startHour}:${window.endHour}`;
    const existing = groups.get(key);
    if (existing) {
      if (!existing.days.includes(window.dayOfWeek)) {
        existing.days.push(window.dayOfWeek);
        existing.days.sort((a, b) => a - b);
      }
      continue;
    }
    groups.set(key, {
      days: [window.dayOfWeek],
      startHour: window.startHour,
      endHour: window.endHour,
    });
  }
  return [...groups.values()];
}

export function coachIsAvailableAtHour(
  availability: CoachAvailabilityWindow[],
  dayOfWeek: number,
  hour: number,
): boolean {
  return availability.some(
    (window) =>
      window.dayOfWeek === dayOfWeek &&
      hour >= window.startHour &&
      hour < window.endHour,
  );
}

export type CoachingBusyRow = {
  coach_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
};

/**
 * Hourly coaching slots: one row per active coach. Hours outside a coach's
 * weekly availability are omitted (the picker shows "·"). Confirmed sessions
 * mark the slot Taken.
 */
export function buildCoachHourlySlotGrid(
  coaches: Array<{
    id: string;
    name: string;
    availability: CoachAvailabilityWindow[];
  }>,
  busy: CoachingBusyRow[],
  options: {
    fromMs: number;
    dayCount?: number;
    timeZone: string;
    locale?: string;
    now?: number;
    openHour: number;
    closeHour: number;
  },
): HourlySlotGrid {
  const dayCount = options.dayCount ?? PUBLIC_BOOKING_LOOKAHEAD_DAYS;
  const timeZone = options.timeZone;
  const locale = options.locale ?? "en-US";
  const now = options.now ?? options.fromMs;
  const hours = bookingHourColumns(options.openHour, options.closeHour);
  const dayKeys = upcomingDayKeys(options.fromMs, dayCount, timeZone);

  const days = dayKeys.map((key) => ({
    key,
    ...formatCalendarDay(key, timeZone, locale),
  }));

  const bookingsByCoach = new Map<
    string,
    Array<{ courtId: string; startsAt: number; endsAt: number }>
  >();
  for (const coach of coaches) {
    bookingsByCoach.set(coach.id, []);
  }
  for (const row of busy) {
    if (row.status !== "confirmed" && row.status !== "pending") continue;
    const startsAt = new Date(row.starts_at).getTime();
    const endsAt = new Date(row.ends_at).getTime();
    if (Number.isNaN(startsAt) || Number.isNaN(endsAt) || endsAt <= startsAt) {
      continue;
    }
    bookingsByCoach.get(row.coach_id)?.push({
      courtId: row.coach_id,
      startsAt,
      endsAt,
    });
  }

  const slots: HourlyBookableSlot[] = [];

  for (const coach of coaches) {
    const coachBookings = bookingsByCoach.get(coach.id) ?? [];
    for (const dayKey of dayKeys) {
      const dayOfWeek = weekdayIndexForDayKey(dayKey, timeZone);
      for (const hour of hours) {
        if (!coachIsAvailableAtHour(coach.availability, dayOfWeek, hour)) {
          continue;
        }
        const startsAt = zonedSlotToUtc(dayKey, hour, timeZone);
        const endsAt = startsAt + BOOKING_SLOT_DURATION_MS;
        slots.push({
          courtId: coach.id,
          courtName: coach.name,
          dayKey,
          hour,
          startsAt,
          endsAt,
          status: slotStatus(startsAt, endsAt, coachBookings, now),
        });
      }
    }
  }

  return { days, hours, slots };
}

/** Default session price = hourly rate × number of hours. */
export function coachingSessionPriceCents(
  rateCents: number,
  hourCount: number,
): number {
  if (rateCents < 0 || hourCount < 1) return 0;
  return rateCents * hourCount;
}

export function parseCoachName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 120) return null;
  return trimmed;
}

export function parseCoachRateCents(value: unknown): number | "invalid" {
  const parsed = parsePriceToCents(value);
  if (parsed === "invalid") return "invalid";
  if (parsed == null) return "invalid";
  return parsed;
}

export function parseAvailabilityFromForm(
  formData: FormData,
): CoachAvailabilityWindow[] | "invalid" {
  const days = formData.getAll("availabilityDay");
  const starts = formData.getAll("availabilityStart");
  const ends = formData.getAll("availabilityEnd");
  if (days.length === 0) return [];
  if (days.length !== starts.length || days.length !== ends.length) {
    return "invalid";
  }

  const windows: CoachAvailabilityWindow[] = [];
  for (let i = 0; i < days.length; i++) {
    const dayOfWeek = Number(String(days[i]));
    const startHour = Number(String(starts[i]));
    const endHour = Number(String(ends[i]));
    if (!validateAvailabilityWindow(dayOfWeek, startHour, endHour)) {
      return "invalid";
    }
    windows.push({ dayOfWeek, startHour, endHour });
  }
  return windows;
}

export type PublicCoach = {
  id: string;
  name: string;
  rateCents: number;
  availability: CoachAvailabilityWindow[];
};

export function parsePublicCoaches(value: unknown): PublicCoach[] {
  if (!Array.isArray(value)) return [];
  const coaches: PublicCoach[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.name !== "string") {
      continue;
    }
    const rateCents =
      typeof record.rateCents === "number" && Number.isFinite(record.rateCents)
        ? Math.max(0, Math.round(record.rateCents))
        : 0;
    const availability: CoachAvailabilityWindow[] = [];
    if (Array.isArray(record.availability)) {
      for (const window of record.availability) {
        if (!window || typeof window !== "object") continue;
        const w = window as Record<string, unknown>;
        const dayOfWeek = Number(w.dayOfWeek);
        const startHour = Number(w.startHour);
        const endHour = Number(w.endHour);
        if (!validateAvailabilityWindow(dayOfWeek, startHour, endHour)) {
          continue;
        }
        availability.push({ dayOfWeek, startHour, endHour });
      }
    }
    coaches.push({
      id: record.id,
      name: record.name,
      rateCents,
      availability,
    });
  }
  return coaches;
}

export type CoachingRequestStatus = {
  kind: "coaching";
  status: "pending" | "confirmed" | "cancelled";
  bookedByName: string;
  startsAt: string;
  endsAt: string;
  venueName: string;
  venueSlug: string;
  venueTimezone: string;
  coachName: string;
  courtName: string;
  priceCents: number | null;
};

export function parseCoachingRequestStatus(
  value: unknown,
): CoachingRequestStatus | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.kind !== "coaching") return null;
  const status = record.status;
  if (
    status !== "pending" &&
    status !== "confirmed" &&
    status !== "cancelled"
  ) {
    return null;
  }
  if (typeof record.bookedByName !== "string") return null;
  if (
    typeof record.startsAt !== "string" ||
    typeof record.endsAt !== "string"
  ) {
    return null;
  }
  if (
    typeof record.venueName !== "string" ||
    typeof record.venueSlug !== "string"
  ) {
    return null;
  }
  if (typeof record.coachName !== "string") return null;
  if (typeof record.courtName !== "string") return null;

  return {
    kind: "coaching",
    status,
    bookedByName: record.bookedByName,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    venueName: record.venueName,
    venueSlug: record.venueSlug,
    venueTimezone:
      typeof record.venueTimezone === "string" ? record.venueTimezone : "UTC",
    coachName: record.coachName,
    courtName: record.courtName,
    priceCents:
      typeof record.priceCents === "number" ? record.priceCents : null,
  };
}

/** Courts with no overlapping busy window for [startsAt, endsAt). */
export function courtsAvailableForRange(
  courts: Array<{ id: string; name: string }>,
  busy: Array<{ court_id: string; starts_at: string; ends_at: string }>,
  startsAt: number,
  endsAt: number,
): Array<{ id: string; name: string }> {
  return courts.filter((court) => {
    return !busy.some((row) => {
      if (row.court_id !== court.id) return false;
      const busyStart = new Date(row.starts_at).getTime();
      const busyEnd = new Date(row.ends_at).getTime();
      if (Number.isNaN(busyStart) || Number.isNaN(busyEnd)) return false;
      return startsAt < busyEnd && busyStart < endsAt;
    });
  });
}

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
