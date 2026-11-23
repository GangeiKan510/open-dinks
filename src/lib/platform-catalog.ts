import { CLUB_MONTHLY_PHP, TOURNAMENT_DAY_PHP } from "@/lib/entitlements";

export const PLAN_PRICE_MIN_PHP = 1;
export const PLAN_PRICE_MAX_PHP = 100_000;

export const CATALOG_ERROR_MESSAGES = {
  price: "Enter a whole peso amount from 1 to 100,000.",
  save: "Could not save the plan settings. Try again.",
} as const;

/** What the operator has published for prices and which features are shown. */
export type PlanCatalog = {
  clubMonthlyPhp: number;
  tournamentDayPhp: number;
  openPlay: boolean;
  booking: boolean;
  tournament: boolean;
};

/**
 * Used when the settings row cannot be read.
 * Booking stays hidden until an operator turns it on.
 */
export const DEFAULT_PLAN_CATALOG: PlanCatalog = {
  clubMonthlyPhp: CLUB_MONTHLY_PHP,
  tournamentDayPhp: TOURNAMENT_DAY_PHP,
  openPlay: true,
  booking: false,
  tournament: true,
};

export function parsePlanPricePhp(value: unknown): number | null {
  const raw =
    typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  const amount = Number(raw);
  if (
    !Number.isInteger(amount) ||
    amount < PLAN_PRICE_MIN_PHP ||
    amount > PLAN_PRICE_MAX_PHP
  ) {
    return null;
  }
  return amount;
}

export function planCatalogFromRow(
  row:
    | {
        club_monthly_php?: number | null;
        tournament_day_php?: number | null;
        show_open_play?: boolean | null;
        show_booking?: boolean | null;
        show_tournament?: boolean | null;
      }
    | null
    | undefined,
): PlanCatalog {
  if (!row) return DEFAULT_PLAN_CATALOG;
  return {
    clubMonthlyPhp:
      parsePlanPricePhp(row.club_monthly_php) ??
      DEFAULT_PLAN_CATALOG.clubMonthlyPhp,
    tournamentDayPhp:
      parsePlanPricePhp(row.tournament_day_php) ??
      DEFAULT_PLAN_CATALOG.tournamentDayPhp,
    openPlay: row.show_open_play ?? DEFAULT_PLAN_CATALOG.openPlay,
    booking: row.show_booking ?? DEFAULT_PLAN_CATALOG.booking,
    tournament: row.show_tournament ?? DEFAULT_PLAN_CATALOG.tournament,
  };
}

export function clubPriceCentavos(
  catalog: Pick<PlanCatalog, "clubMonthlyPhp">,
): number {
  return catalog.clubMonthlyPhp * 100;
}
