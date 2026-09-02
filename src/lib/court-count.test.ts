import { describe, expect, it } from "vitest";
import {
  buildCourtNames,
  DEFAULT_COURT_COUNT,
  MAX_COURT_COUNT,
  MIN_COURT_COUNT,
  normalizeCourtCount,
  planCourtCountChange,
  type CourtLike,
} from "@/lib/court-count";

describe("court count", () => {
  it("enforces a minimum of one court", () => {
    expect(normalizeCourtCount(0)).toBe(MIN_COURT_COUNT);
    expect(normalizeCourtCount(-2)).toBe(MIN_COURT_COUNT);
    expect(normalizeCourtCount("0")).toBe(MIN_COURT_COUNT);
    expect(normalizeCourtCount(null)).toBe(DEFAULT_COURT_COUNT);
  });

  it("caps court count for very large facilities", () => {
    expect(normalizeCourtCount(99)).toBe(MAX_COURT_COUNT);
  });

  it("accepts valid court counts", () => {
    expect(normalizeCourtCount(1)).toBe(1);
    expect(normalizeCourtCount("6")).toBe(6);
    expect(normalizeCourtCount(12)).toBe(12);
  });

  it("builds court names for the requested count", () => {
    expect(buildCourtNames(1)).toEqual(["Court 1"]);
    expect(buildCourtNames(4)).toEqual([
      "Court 1",
      "Court 2",
      "Court 3",
      "Court 4",
    ]);
  });
});

describe("planCourtCountChange", () => {
  function courts(count: number): CourtLike[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `court-${i + 1}`,
      name: `Court ${i + 1}`,
      sort_order: i + 1,
    }));
  }

  it("is a no-op when the count already matches", () => {
    expect(planCourtCountChange(courts(3), 3)).toEqual({
      toAdd: [],
      toRemove: [],
    });
  });

  it("appends courts continuing the existing numbering", () => {
    expect(planCourtCountChange(courts(2), 4).toAdd).toEqual([
      { name: "Court 3", sort_order: 3 },
      { name: "Court 4", sort_order: 4 },
    ]);
  });

  it("adds from scratch when the venue has no courts yet", () => {
    expect(planCourtCountChange([], 2).toAdd).toEqual([
      { name: "Court 1", sort_order: 1 },
      { name: "Court 2", sort_order: 2 },
    ]);
  });

  it("continues past a gap in sort_order instead of reusing a taken slot", () => {
    const existing: CourtLike[] = [
      { id: "a", name: "Court 1", sort_order: 1 },
      { id: "b", name: "Stadium", sort_order: 9 },
    ];
    expect(planCourtCountChange(existing, 3).toAdd).toEqual([
      { name: "Court 3", sort_order: 10 },
    ]);
  });

  it("trims from the end, highest-numbered first", () => {
    const plan = planCourtCountChange(courts(4), 2);
    expect(plan.toAdd).toEqual([]);
    expect(plan.toRemove.map((c) => c.id)).toEqual(["court-4", "court-3"]);
  });

  it("never trims below one court", () => {
    const plan = planCourtCountChange(courts(3), 0);
    expect(plan.toRemove.map((c) => c.id)).toEqual(["court-3", "court-2"]);
  });

  it("orders deterministically when sort_order values collide", () => {
    const existing: CourtLike[] = [
      { id: "b", name: "B", sort_order: 1 },
      { id: "a", name: "A", sort_order: 1 },
    ];
    expect(planCourtCountChange(existing, 1).toRemove.map((c) => c.id)).toEqual(
      ["b"],
    );
  });

  it("does not mutate the courts it was given", () => {
    const existing = courts(3);
    planCourtCountChange(existing, 1);
    expect(existing.map((c) => c.id)).toEqual([
      "court-1",
      "court-2",
      "court-3",
    ]);
  });
});
