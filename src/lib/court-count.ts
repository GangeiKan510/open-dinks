export const MIN_COURT_COUNT = 1;
export const MAX_COURT_COUNT = 32;
export const DEFAULT_COURT_COUNT = 3;

/** Clamp a court count for sessions and venue setup (min 1). */
export function normalizeCourtCount(
  value: unknown,
  fallback: number = DEFAULT_COURT_COUNT,
): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number.parseInt(value, 10)
        : Number.NaN;

  const resolved = Number.isFinite(parsed)
    ? Math.floor(parsed)
    : normalizeCourtCount(fallback, MIN_COURT_COUNT);

  return Math.min(MAX_COURT_COUNT, Math.max(MIN_COURT_COUNT, resolved));
}

export function buildCourtNames(count: number): string[] {
  const normalized = normalizeCourtCount(count, MIN_COURT_COUNT);
  return Array.from({ length: normalized }, (_, i) => `Court ${i + 1}`);
}
