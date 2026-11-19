/**
 * Club plan and tournament-day rules.
 *
 * Open play and booking run on a 7-day trial, then a ₱699 club month.
 * Tournament mode is separate: one local day for ₱1,500 or four consecutive
 * local days for ₱4,000. Either can be bought on its own. Unused days in a
 * tournament window expire. Players are not billed.
 */

export const TRIAL_DAYS = 7;
export const CLUB_MONTHLY_PHP = 699;
export const TOURNAMENT_DAY_PHP = 1500;
export const TOURNAMENT_WEEKEND_PHP = 4000;
export const TOURNAMENT_WEEKEND_DAYS = 4;

/** PayMongo charges PHP in centavos. */
export const CLUB_PRICE_CENTAVOS = CLUB_MONTHLY_PHP * 100;
export const TOURNAMENT_DAY_CENTAVOS = TOURNAMENT_DAY_PHP * 100;
export const TOURNAMENT_WEEKEND_CENTAVOS = TOURNAMENT_WEEKEND_PHP * 100;

export const BILLING_LOCK_CODE = "P0403";

export type ClubStatus = "none" | "active" | "past_due" | "canceled";
export type PassKind = "day" | "weekend";
export type ClubPhase = "trial" | "active" | "locked";

export type TournamentPassWindow = {
  startsOn: string;
  endsOn: string;
};

export type FeatureAccess = {
  openPlay: boolean;
  booking: boolean;
  tournament: boolean;
  /** Paid club period. The trial does not count. */
  clubPaid: boolean;
  phase: ClubPhase;
  trialDaysLeft: number;
  clubPeriodEnd: string | null;
  /** First local date of the passes that cover today. */
  tournamentStartsOn: string | null;
  /** Last local date of a pass that covers today, when tournament mode is open. */
  tournamentThrough: string | null;
};

export type BillingSnapshot = {
  now: Date;
  timeZone: string;
  trialEndsAt: string | null;
  clubStatus: ClubStatus;
  clubPeriodEnd: string | null;
  passes: TournamentPassWindow[];
};

const DAY_MS = 86_400_000;

function formatCalendarDate(iso: string): string {
  if (!isCalendarDate(iso)) return "";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

/** One local day, or the first and last day of the paid tournament window. */
export function formatTournamentDates(
  startsOn: string | null,
  endsOn: string | null,
): string {
  if (!startsOn || !endsOn) return "";
  const start = formatCalendarDate(startsOn);
  const end = formatCalendarDate(endsOn);
  if (!start || !end) return "";
  if (startsOn === endsOn) return start;
  return `${start} – ${end}`;
}

export function formatPeso(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Venue-local calendar day as YYYY-MM-DD. */
export function localDateISO(timeZone: string, date: Date): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }
}

/** True for a real YYYY-MM-DD. Rejects overflow dates such as 2026-02-30. */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return false;
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.toISOString().slice(0, 10) === value;
}

export function addCalendarDays(isoDate: string, days: number): string | null {
  if (!isCalendarDate(isoDate) || !Number.isInteger(days)) return null;
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year!, month! - 1, day!));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function tournamentPassWindow(
  kind: PassKind,
  startsOn: string,
): TournamentPassWindow | null {
  if (!isCalendarDate(startsOn)) return null;
  if (kind === "day") return { startsOn, endsOn: startsOn };
  const endsOn = addCalendarDays(startsOn, TOURNAMENT_WEEKEND_DAYS - 1);
  if (!endsOn) return null;
  return { startsOn, endsOn };
}

/**
 * Rebuild a pass from checkout metadata. The end date is derived from the
 * kind so a longer `ends_on` in the payload cannot extend the window.
 */
export function passFromCheckoutMetadata(
  metadata: {
    kind?: string | null;
    starts_on?: string | null;
  } | null,
): (TournamentPassWindow & { kind: PassKind }) | null {
  const kind = metadata?.kind;
  if (kind !== "day" && kind !== "weekend") return null;
  const window = tournamentPassWindow(kind, metadata?.starts_on ?? "");
  if (!window) return null;
  return { kind, ...window };
}

/** Add calendar months in UTC, clamping a 31st onto the last day of a shorter month. */
export function addUtcMonths(from: Date, months: number): Date {
  const year = from.getUTCFullYear();
  const monthIndex = from.getUTCMonth() + months;
  const day = from.getUTCDate();
  const stamp = new Date(
    Date.UTC(
      year,
      monthIndex,
      1,
      from.getUTCHours(),
      from.getUTCMinutes(),
      from.getUTCSeconds(),
      from.getUTCMilliseconds(),
    ),
  );
  const lastDay = new Date(
    Date.UTC(stamp.getUTCFullYear(), stamp.getUTCMonth() + 1, 0),
  ).getUTCDate();
  stamp.setUTCDate(Math.min(day, lastDay));
  return stamp;
}

/**
 * One prepaid club month. A payment made while the plan is still active
 * starts at the current end, so paying early does not throw away days.
 */
export function nextClubPeriodEnd(
  now: Date,
  currentPeriodEnd: string | null,
): Date {
  const current = currentPeriodEnd ? Date.parse(currentPeriodEnd) : Number.NaN;
  const base =
    Number.isFinite(current) && current > now.getTime()
      ? new Date(current)
      : now;
  return addUtcMonths(base, 1);
}

export function trialDaysLeft(now: Date, trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0;
  const end = Date.parse(trialEndsAt);
  if (!Number.isFinite(end) || end <= now.getTime()) return 0;
  return Math.ceil((end - now.getTime()) / DAY_MS);
}

function inFuture(now: Date, iso: string | null): boolean {
  if (!iso) return false;
  const end = Date.parse(iso);
  return Number.isFinite(end) && end > now.getTime();
}

function passCovers(pass: TournamentPassWindow, day: string): boolean {
  return (
    isCalendarDate(pass.startsOn) &&
    isCalendarDate(pass.endsOn) &&
    pass.startsOn <= day &&
    day <= pass.endsOn
  );
}

export function resolveFeatureAccess(snapshot: BillingSnapshot): FeatureAccess {
  const today = localDateISO(snapshot.timeZone, snapshot.now);
  const trialLeft = trialDaysLeft(snapshot.now, snapshot.trialEndsAt);
  const inTrial = trialLeft > 0;
  const clubPaid =
    snapshot.clubStatus === "active" &&
    inFuture(snapshot.now, snapshot.clubPeriodEnd);
  const clubOpen = inTrial || clubPaid;
  const covering = snapshot.passes.filter((pass) => passCovers(pass, today));
  const tournamentStartsOn =
    covering.length === 0
      ? null
      : covering.reduce(
          (earliest, pass) =>
            pass.startsOn < earliest ? pass.startsOn : earliest,
          covering[0]!.startsOn,
        );
  const tournamentThrough =
    covering.length === 0
      ? null
      : covering.reduce(
          (latest, pass) => (pass.endsOn > latest ? pass.endsOn : latest),
          covering[0]!.endsOn,
        );

  return {
    openPlay: clubOpen,
    booking: clubOpen,
    tournament: tournamentThrough !== null,
    clubPaid,
    phase: clubPaid ? "active" : inTrial ? "trial" : "locked",
    trialDaysLeft: trialLeft,
    clubPeriodEnd: clubPaid ? snapshot.clubPeriodEnd : null,
    tournamentStartsOn,
    tournamentThrough,
  };
}
