/** Default first bookable hour in venue local time (inclusive). */
export const DEFAULT_BOOKING_OPEN_HOUR = 6;

/** Default last bookable hour start in venue local time (exclusive end at this hour). */
export const DEFAULT_BOOKING_CLOSE_HOUR = 22;

/** Close hour for 24-hour booking (midnight end, slots 0–23). */
export const BOOKING_CLOSE_HOUR_24 = 24;

export type BookingHours = {
  openHour: number;
  closeHour: number;
};

export const BOOKING_HOURS_ERROR_MESSAGES = {
  invalid: "Choose valid opening and closing hours.",
  order: "Closing time must be after opening time.",
} as const;

export function is24HourBooking(hours: BookingHours): boolean {
  return hours.openHour === 0 && hours.closeHour === BOOKING_CLOSE_HOUR_24;
}

export function normalizeBookingHours(
  partial?: Partial<BookingHours> | null,
): BookingHours {
  const openHour = partial?.openHour ?? DEFAULT_BOOKING_OPEN_HOUR;
  const closeHour = partial?.closeHour ?? DEFAULT_BOOKING_CLOSE_HOUR;
  if (validateBookingHours(openHour, closeHour)) {
    return { openHour, closeHour };
  }
  return {
    openHour: DEFAULT_BOOKING_OPEN_HOUR,
    closeHour: DEFAULT_BOOKING_CLOSE_HOUR,
  };
}

export function validateBookingHours(
  openHour: number,
  closeHour: number,
): boolean {
  if (!Number.isInteger(openHour) || !Number.isInteger(closeHour)) {
    return false;
  }
  if (openHour < 0 || openHour > 23) return false;
  if (closeHour < 1 || closeHour > BOOKING_CLOSE_HOUR_24) return false;
  return closeHour > openHour;
}

export function parseBookingHoursField(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) ? parsed : null;
}

export function parseBookingHoursForm(
  openRaw: unknown,
  closeRaw: unknown,
  open24Hours: boolean,
): BookingHours | "invalid" {
  if (open24Hours) {
    return { openHour: 0, closeHour: BOOKING_CLOSE_HOUR_24 };
  }

  const openHour = parseBookingHoursField(openRaw);
  const closeHour = parseBookingHoursField(closeRaw);
  if (openHour == null || closeHour == null) return "invalid";
  if (!validateBookingHours(openHour, closeHour)) return "invalid";
  return { openHour, closeHour };
}

/** Whole-hour columns for the booking calendar (close is exclusive). */
export function bookingHourColumns(
  openHour: number,
  closeHour: number,
): number[] {
  const hours: number[] = [];
  for (let hour = openHour; hour < closeHour; hour++) {
    hours.push(hour);
  }
  return hours;
}

export function formatBookingHourLabel(
  hour: number,
  options?: { locale?: string; timeZone?: string },
): string {
  const locale = options?.locale ?? "en-US";
  // `hour` is already a venue-local wall-clock value (0–24). Format it as UTC
  // so the label matches the integer. Passing the venue timezone here used to
  // shift labels (e.g. hour 21 showed as "5:00 AM" in Asia/Manila).
  void options?.timeZone;
  const normalized = hour === 24 ? 0 : hour;
  const probe = Date.UTC(2026, 0, 1, normalized, 0);
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(probe);
}

export function formatBookingHoursRange(
  hours: BookingHours,
  options?: { locale?: string; timeZone?: string },
): string {
  if (is24HourBooking(hours)) return "24 hours (midnight – midnight)";

  const locale = options?.locale;
  const timeZone = options?.timeZone;
  const open = formatBookingHourLabel(hours.openHour, { locale, timeZone });
  if (hours.closeHour === BOOKING_CLOSE_HOUR_24) {
    return `${open} – midnight`;
  }
  const close = formatBookingHourLabel(hours.closeHour, { locale, timeZone });
  return `${open} – ${close}`;
}

/** Options for open-hour select (0–23). */
export function bookingOpenHourOptions(): number[] {
  return Array.from({ length: 24 }, (_, hour) => hour);
}

/** Options for close-hour select (1–24, where 24 = end of day). */
export function bookingCloseHourOptions(): number[] {
  return Array.from({ length: 24 }, (_, index) => index + 1);
}
