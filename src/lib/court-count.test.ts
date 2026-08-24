import { describe, expect, it } from "vitest";
import {
  buildCourtNames,
  DEFAULT_COURT_COUNT,
  MAX_COURT_COUNT,
  MIN_COURT_COUNT,
  normalizeCourtCount,
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
