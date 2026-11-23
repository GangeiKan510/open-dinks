/**
 * Club plan and tournament-day rules.
 *
 * Open play and booking run on a 7-day trial, then a ₱799 club month.
 * Tournament mode is separate. The host picks the dates, and they do not have
 * to be in a row. Each day is ₱2,000. A day that was not picked stays locked. Setup opens as soon as a paid
 * day is still ahead. Building brackets waits for that day, and stays open
 * until 6:00 AM the next morning. Consecutive days share that extra time
 * after the last day only. Players are not billed.
 */

export const TRIAL_DAYS = 7;
export const CLUB_MONTHLY_PHP = 799;
export const TOURNAMENT_DAY_PHP = 2000;
/** Per day once the host picks at least this many dates in one purchase. */
export const TOURNAMENT_VOLUME_DAY_PHP = 2000;
export const TOURNAMENT_VOLUME_MIN_DAYS = 4;
export const TOURNAMENT_MAX_DAYS = 14;
/** Hours after midnight that the last day of a run stays open. */
export const TOURNAMENT_GRACE_HOURS = 6;
/** Previous four-day price. Kept so older payments still report ₱4,000. */
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
  /** True on a paid day, and until 6:00 AM the next morning. Brackets use this. */
  tournament: boolean;
  /** True while a paid day is still ahead, today, or inside the morning grace. */
  tournamentSetup: boolean;
  /** Paid dates from today onward. The date picker will not sell these again. */
  ownedTournamentDates: string[];
  /** Paid club period. The trial does not count. */
  clubPaid: boolean;
  /** True until the host starts the club trial or pays for a club month. */
  clubTrialAvailable: boolean;
  phase: ClubPhase;
  trialDaysLeft: number;
  /** True until the host starts a trial or pays for club or tournament access. */
  awaitingPlanChoice: boolean;
  clubPeriodEnd: string | null;
  /** First local date of the passes that cover today. */
  tournamentStartsOn: string | null;
  /** Last local date of a pass that covers now, including the morning grace. */
  tournamentThrough: string | null;
  /** True when now is after midnight and before the grace cutoff. */
  tournamentGrace: boolean;
};

export type BillingSnapshot = {
  now: Date;
  timeZone: string;
  trialEndsAt: string | null;
  clubStatus: ClubStatus;
  clubPeriodEnd: string | null;
  passes: TournamentPassWindow[];
  /**
   * False until the host starts the trial or a payment is confirmed.
   * Omitted means the choice already happened.
   */
  choiceMade?: boolean;
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

/** Venue-local hour, 0 through 23. */
export function localHour(timeZone: string, date: Date): number {
  try {
    const hour = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const value = Number(hour.find((part) => part.type === "hour")?.value);
    if (!Number.isFinite(value)) return date.getUTCHours();
    return value === 24 ? 0 : value;
  } catch {
    return date.getUTCHours();
  }
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

export function tournamentDayRatePhp(dayCount: number): number {
  return dayCount >= TOURNAMENT_VOLUME_MIN_DAYS
    ? TOURNAMENT_VOLUME_DAY_PHP
    : TOURNAMENT_DAY_PHP;
}

/**
 * Sorted unique calendar dates from a checkout list.
 * Rejects duplicates, empty lists, and more than the purchase cap.
 */
export function parseTournamentDates(value: string): string[] | null {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0 || parts.length > TOURNAMENT_MAX_DAYS) return null;
  if (!parts.every((part) => isCalendarDate(part))) return null;
  const unique = [...new Set(parts)].sort();
  if (unique.length !== parts.length) return null;
  return unique;
}

export function tournamentDatesPriceCentavos(
  dates: readonly string[],
  dayPhp: number = TOURNAMENT_DAY_PHP,
): number | null {
  if (dates.length === 0 || dates.length > TOURNAMENT_MAX_DAYS) return null;
  if (!Number.isInteger(dayPhp) || dayPhp < 1) return null;
  return dayPhp * dates.length * 100;
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

function datesInPass(pass: TournamentPassWindow): string[] {
  if (
    !isCalendarDate(pass.startsOn) ||
    !isCalendarDate(pass.endsOn) ||
    pass.endsOn < pass.startsOn
  ) {
    return [];
  }
  const dates: string[] = [];
  let cursor: string | null = pass.startsOn;
  while (cursor && cursor <= pass.endsOn && dates.length < 400) {
    dates.push(cursor);
    cursor = addCalendarDays(cursor, 1);
  }
  return dates;
}

/** Paid calendar dates that are still today or later. */
export function ownedTournamentDates(
  passes: TournamentPassWindow[],
  today: string,
): string[] {
  const owned = new Set<string>();
  for (const pass of passes) {
    for (const date of datesInPass(pass)) {
      if (date >= today) owned.add(date);
    }
  }
  return [...owned].sort();
}

/** Groups consecutive dates into the same label used for one pass. */
export function formatTournamentDateList(dates: string[]): string {
  const sorted = [...new Set(dates.filter(isCalendarDate))].sort();
  const runs: { start: string; end: string }[] = [];
  for (const date of sorted) {
    const last = runs[runs.length - 1];
    if (last && addCalendarDays(last.end, 1) === date) last.end = date;
    else runs.push({ start: date, end: date });
  }
  return runs
    .map((run) => formatTournamentDates(run.start, run.end))
    .join(", ");
}

/** Shown while setup is open and bracket building is still closed. */
export function bracketBuildNotice(datesLabel: string): string {
  const when = datesLabel.trim();
  if (!when) {
    return "Brackets can be built on a tournament day. You can still set up categories and teams.";
  }
  return `Brackets can be built on ${when}. You can still set up categories and teams.`;
}

export function resolveFeatureAccess(snapshot: BillingSnapshot): FeatureAccess {
  const today = localDateISO(snapshot.timeZone, snapshot.now);
  const trialLeft = trialDaysLeft(snapshot.now, snapshot.trialEndsAt);
  const inTrial = trialLeft > 0;
  const clubPaid =
    snapshot.clubStatus === "active" &&
    inFuture(snapshot.now, snapshot.clubPeriodEnd);
  const clubOpen = inTrial || clubPaid;
  const todayCovering = snapshot.passes.filter((pass) =>
    passCovers(pass, today),
  );
  const yesterday = addCalendarDays(today, -1);
  const inGrace =
    todayCovering.length === 0 &&
    localHour(snapshot.timeZone, snapshot.now) < TOURNAMENT_GRACE_HOURS &&
    yesterday != null;
  const covering = todayCovering.length
    ? todayCovering
    : inGrace
      ? snapshot.passes.filter((pass) => passCovers(pass, yesterday))
      : [];
  const tournamentGrace = inGrace && covering.length > 0;
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
  const tournament = tournamentThrough !== null;
  const paidAhead = ownedTournamentDates(snapshot.passes, today);
  const tournamentSetup = tournament || paidAhead.length > 0;
  const clubTrialAvailable =
    snapshot.trialEndsAt == null && snapshot.clubPeriodEnd == null;

  return {
    openPlay: clubOpen,
    booking: clubOpen,
    tournament,
    tournamentSetup,
    ownedTournamentDates: paidAhead,
    clubPaid,
    clubTrialAvailable,
    phase: clubPaid ? "active" : inTrial ? "trial" : "locked",
    trialDaysLeft: trialLeft,
    awaitingPlanChoice:
      snapshot.choiceMade === false &&
      !clubPaid &&
      !inTrial &&
      !tournamentSetup,
    clubPeriodEnd: clubPaid ? snapshot.clubPeriodEnd : null,
    tournamentStartsOn,
    tournamentThrough,
    tournamentGrace,
  };
}
