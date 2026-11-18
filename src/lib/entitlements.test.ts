import { describe, expect, it } from "vitest";
import {
  CLUB_MONTHLY_PHP,
  CLUB_PRICE_CENTAVOS,
  TOURNAMENT_DAY_PHP,
  TOURNAMENT_WEEKEND_DAYS,
  TOURNAMENT_WEEKEND_PHP,
  addCalendarDays,
  addUtcMonths,
  formatPeso,
  nextClubPeriodEnd,
  isCalendarDate,
  resolveFeatureAccess,
  passFromCheckoutMetadata,
  tournamentPassWindow,
  type BillingSnapshot,
} from "@/lib/entitlements";

const NOW = new Date("2026-11-18T06:00:00.000Z");

function snapshot(overrides: Partial<BillingSnapshot> = {}): BillingSnapshot {
  return {
    now: NOW,
    timeZone: "Asia/Manila",
    trialEndsAt: null,
    clubStatus: "none",
    clubPeriodEnd: null,
    passes: [],
    ...overrides,
  };
}

describe("tournament pass windows", () => {
  it("keeps a day pass on that local date", () => {
    expect(tournamentPassWindow("day", "2026-11-21")).toEqual({
      startsOn: "2026-11-21",
      endsOn: "2026-11-21",
    });
  });

  it("covers four consecutive days, including the start date", () => {
    expect(tournamentPassWindow("weekend", "2026-11-20")).toEqual({
      startsOn: "2026-11-20",
      endsOn: "2026-11-23",
    });
    expect(TOURNAMENT_WEEKEND_DAYS).toBe(4);
  });

  it("rebuilds a weekend from the start date and ignores a longer end", () => {
    expect(
      passFromCheckoutMetadata({
        kind: "weekend",
        starts_on: "2026-11-20",
      }),
    ).toEqual({
      kind: "weekend",
      startsOn: "2026-11-20",
      endsOn: "2026-11-23",
    });
    expect(
      passFromCheckoutMetadata({ kind: "season", starts_on: "2026-11-20" }),
    ).toBeNull();
  });

  it("rejects overflow dates", () => {
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(tournamentPassWindow("day", "2026-02-30")).toBeNull();
    expect(addCalendarDays("2026-02-30", 1)).toBeNull();
  });
});

describe("resolveFeatureAccess", () => {
  it("opens play and booking during the trial and keeps tournament locked", () => {
    const access = resolveFeatureAccess(
      snapshot({ trialEndsAt: "2026-11-20T06:00:00.000Z" }),
    );
    expect(access.phase).toBe("trial");
    expect(access.openPlay).toBe(true);
    expect(access.booking).toBe(true);
    expect(access.tournament).toBe(false);
    expect(access.clubPaid).toBe(false);
    expect(access.trialDaysLeft).toBe(2);
  });

  it("locks the club when the trial is over and no plan is paid", () => {
    const access = resolveFeatureAccess(
      snapshot({ trialEndsAt: "2026-11-18T05:00:00.000Z" }),
    );
    expect(access.phase).toBe("locked");
    expect(access.openPlay).toBe(false);
    expect(access.booking).toBe(false);
    expect(access.tournament).toBe(false);
    expect(access.trialDaysLeft).toBe(0);
  });

  it("keeps open play on a paid club and still requires a tournament pass", () => {
    const access = resolveFeatureAccess(
      snapshot({
        clubStatus: "active",
        clubPeriodEnd: "2026-12-18T06:00:00.000Z",
      }),
    );
    expect(access.phase).toBe("active");
    expect(access.clubPaid).toBe(true);
    expect(access.openPlay).toBe(true);
    expect(access.tournament).toBe(false);
  });

  it("opens tournament mode when a pass covers today, with or without a club month", () => {
    const access = resolveFeatureAccess(
      snapshot({
        passes: [
          { startsOn: "2026-11-17", endsOn: "2026-11-20" },
          { startsOn: "2026-12-01", endsOn: "2026-12-01" },
        ],
      }),
    );
    expect(access.clubPaid).toBe(false);
    expect(access.openPlay).toBe(false);
    expect(access.tournament).toBe(true);
    expect(access.tournamentThrough).toBe("2026-11-20");
  });

  it("opens tournament mode from a pass even during the trial", () => {
    const access = resolveFeatureAccess(
      snapshot({
        trialEndsAt: "2026-11-25T06:00:00.000Z",
        passes: [{ startsOn: "2026-11-18", endsOn: "2026-11-21" }],
      }),
    );
    expect(access.openPlay).toBe(true);
    expect(access.clubPaid).toBe(false);
    expect(access.tournament).toBe(true);
    expect(access.tournamentThrough).toBe("2026-11-21");
  });

  it("keeps a tournament pass when the club payment is past due", () => {
    const access = resolveFeatureAccess(
      snapshot({
        clubStatus: "past_due",
        clubPeriodEnd: "2026-12-18T06:00:00.000Z",
        passes: [{ startsOn: "2026-11-18", endsOn: "2026-11-18" }],
      }),
    );
    expect(access.clubPaid).toBe(false);
    expect(access.openPlay).toBe(false);
    expect(access.tournament).toBe(true);
    expect(access.tournamentThrough).toBe("2026-11-18");
  });
});

describe("club month", () => {
  it("clamps a 31st onto the last day of February", () => {
    expect(
      addUtcMonths(new Date("2026-01-31T06:00:00.000Z"), 1).toISOString(),
    ).toBe("2026-02-28T06:00:00.000Z");
  });

  it("extends a club month that has not ended yet", () => {
    const next = nextClubPeriodEnd(NOW, "2026-12-01T06:00:00.000Z");
    expect(next.toISOString()).toBe("2027-01-01T06:00:00.000Z");
  });

  it("starts a new month from now when the previous one has ended", () => {
    const next = nextClubPeriodEnd(NOW, "2026-11-01T06:00:00.000Z");
    expect(next.toISOString()).toBe("2026-12-18T06:00:00.000Z");
  });
});

describe("prices", () => {
  it("formats the club and tournament prices in pesos", () => {
    expect(formatPeso(CLUB_MONTHLY_PHP)).toBe("₱699");
    expect(formatPeso(TOURNAMENT_DAY_PHP)).toBe("₱1,500");
    expect(formatPeso(TOURNAMENT_WEEKEND_PHP)).toBe("₱4,000");
    expect(CLUB_PRICE_CENTAVOS).toBe(69900);
  });
});
