import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAN_CATALOG,
  clubPriceCentavos,
  parsePlanPricePhp,
  planCatalogFromRow,
} from "./platform-catalog";

describe("plan prices", () => {
  it("accepts a whole peso amount inside the cap", () => {
    expect(parsePlanPricePhp("799")).toBe(799);
    expect(parsePlanPricePhp(2000)).toBe(2000);
    expect(parsePlanPricePhp("0")).toBeNull();
    expect(parsePlanPricePhp("100001")).toBeNull();
    expect(parsePlanPricePhp("12.5")).toBeNull();
    expect(parsePlanPricePhp("")).toBeNull();
  });

  it("keeps a valid price and falls back when a column is missing", () => {
    expect(
      planCatalogFromRow({
        club_monthly_php: 900,
        tournament_day_php: null,
        show_open_play: true,
        show_booking: true,
        show_tournament: false,
      }),
    ).toEqual({
      clubMonthlyPhp: 900,
      tournamentDayPhp: DEFAULT_PLAN_CATALOG.tournamentDayPhp,
      openPlay: true,
      booking: true,
      tournament: false,
    });
    expect(planCatalogFromRow(null)).toEqual(DEFAULT_PLAN_CATALOG);
    expect(clubPriceCentavos({ clubMonthlyPhp: 900 })).toBe(90000);
  });
});
