const FALLBACK_TIMEZONE = "UTC";

/** Accepts an IANA timezone string; falls back to UTC when blank or invalid. */
export function parseVenueTimezone(value: unknown): string {
  if (typeof value !== "string") return FALLBACK_TIMEZONE;
  const trimmed = value.trim();
  if (!trimmed) return FALLBACK_TIMEZONE;

  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return trimmed;
  } catch {
    return FALLBACK_TIMEZONE;
  }
}

/** Human label for copy such as "All times in Philippine Time". */
export function formatVenueTimezoneLabel(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longGeneric",
    }).formatToParts(new Date());
    const name = parts.find((p) => p.type === "timeZoneName")?.value;
    if (name) return `${name} (${timeZone})`;
  } catch {
    // fall through
  }
  return timeZone;
}

/** Common venue timezones; hosts can still type any valid IANA name. */
export const COMMON_VENUE_TIMEZONES = [
  "Asia/Manila",
  "Asia/Singapore",
  "Asia/Tokyo",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "UTC",
] as const;
