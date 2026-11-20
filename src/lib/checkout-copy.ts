import { formatCheckoutPesos } from "@/lib/discounts";
import {
  CLUB_PRICE_CENTAVOS,
  TOURNAMENT_DAY_PHP,
  TOURNAMENT_VOLUME_MIN_DAYS,
  tournamentDayRatePhp,
} from "@/lib/entitlements";

/** One club month, with the price the amount column will show. */
export function clubCheckoutBase(): string {
  return `Picklrz Club month: open play and booking, ${formatCheckoutPesos(CLUB_PRICE_CENTAVOS)}.`;
}

/** Days times the rate, then the dates. Volume rate says what the shorter rate was. */
export function tournamentCheckoutBase(dates: readonly string[]): string {
  const count = dates.length;
  const rate = formatCheckoutPesos(tournamentDayRatePhp(count) * 100);
  const dayWord = count === 1 ? "day" : "days";
  const volume =
    count >= TOURNAMENT_VOLUME_MIN_DAYS
      ? ` (${formatCheckoutPesos(TOURNAMENT_DAY_PHP * 100)} a day through ${TOURNAMENT_VOLUME_MIN_DAYS - 1})`
      : "";
  return `Picklrz tournament: ${count} ${dayWord} × ${rate}${volume} on ${dates.join(", ")}.`;
}
