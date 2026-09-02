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

export type CourtLike = { id: string; name: string; sort_order: number };

export type CourtCountPlan = {
  toAdd: { name: string; sort_order: number }[];
  /** Highest-numbered courts first, so callers report the last one removed. */
  toRemove: CourtLike[];
};

/** Ascending by sort_order, then id so equal orders stay deterministic. */
function orderCourts(courts: CourtLike[]): CourtLike[] {
  return courts
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
}

/**
 * Work out which courts to add or drop to reach `targetCount`.
 * Courts are trimmed from the end so existing court numbers stay stable.
 */
export function planCourtCountChange(
  courts: CourtLike[],
  targetCount: number,
): CourtCountPlan {
  const target = normalizeCourtCount(targetCount, MIN_COURT_COUNT);
  const ordered = orderCourts(courts);

  if (ordered.length === target) return { toAdd: [], toRemove: [] };

  if (ordered.length > target) {
    return { toAdd: [], toRemove: ordered.slice(target).reverse() };
  }

  const highestOrder = ordered.reduce(
    (max, court) => Math.max(max, court.sort_order),
    0,
  );
  const toAdd = Array.from({ length: target - ordered.length }, (_, index) => ({
    name: `Court ${ordered.length + index + 1}`,
    sort_order: highestOrder + index + 1,
  }));

  return { toAdd, toRemove: [] };
}
