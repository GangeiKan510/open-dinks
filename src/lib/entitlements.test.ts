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
  formatTournamentDates,
  nextClubPeriodEnd,
  parseTournamentDates,
  tournamentDatesPriceCentavos,
  tournamentDayRatePhp,
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

  it("charges 1500 a day through 3 days and 1400 a day from 4", () => {
    expect(tournamentDayRatePhp(1)).toBe(1500);
    expect(tournamentDayRatePhp(3)).toBe(1500);
    expect(
      tournamentDatesPriceCentavos(["2026-11-20", "2026-11-22", "2026-11-25"]),
    ).toBe(450000);
    expect(tournamentDayRatePhp(4)).toBe(1400);
    expect(
      tournamentDatesPriceCentavos([
        "2026-11-20",
        "2026-11-22",
        "2026-11-24",
        "2026-11-27",
      ]),
    ).toBe(560000);
  });

  it("keeps picked dates and rejects gaps that were not chosen", () => {
    expect(parseTournamentDates("2026-11-27, 2026-11-20,2026-11-22")).toEqual([
      "2026-11-20",
      "2026-11-22",
      "2026-11-27",
    ]);
    expect(parseTournamentDates("2026-11-20,2026-11-20")).toBeNull();
    expect(parseTournamentDates("2026-02-30")).toBeNull();
    expect(parseTournamentDates("")).toBeNull();
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

  it("asks for a plan until the host starts a trial or pays", () => {
    const waiting = resolveFeatureAccess(snapshot({ choiceMade: false }));
    expect(waiting.awaitingPlanChoice).toBe(true);
    expect(waiting.openPlay).toBe(false);
    expect(waiting.booking).toBe(false);
    expect(waiting.tournament).toBe(false);

    const paid = resolveFeatureAccess(
      snapshot({
        choiceMade: false,
        clubStatus: "active",
        clubPeriodEnd: "2026-12-18T06:00:00.000Z",
      }),
    );
    expect(paid.awaitingPlanChoice).toBe(false);
    expect(paid.openPlay).toBe(true);
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
    expect(access.tournamentStartsOn).toBe("2026-11-17");
    expect(access.tournamentThrough).toBe("2026-11-20");
    expect(
      formatTournamentDates(
        access.tournamentStartsOn,
        access.tournamentThrough,
      ),
    ).toBe("Nov 17, 2026 – Nov 20, 2026");
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
    expect(access.tournamentStartsOn).toBe("2026-11-18");
    expect(access.tournamentThrough).toBe("2026-11-18");
    expect(
      formatTournamentDates(
        access.tournamentStartsOn,
        access.tournamentThrough,
      ),
    ).toBe("Nov 18, 2026");
  });
});

describe("tournament morning grace", () => {
  it("keeps a single day open until 6:00 AM the next morning", () => {
    const passes = [{ startsOn: "2026-11-23", endsOn: "2026-11-23" }];
    const during = resolveFeatureAccess(
      snapshot({
        now: new Date("2026-11-23T19:00:00.000Z"),
        passes,
      }),
    );
    expect(during.tournament).toBe(true);
    expect(during.tournamentGrace).toBe(true);
    expect(during.tournamentThrough).toBe("2026-11-23");

    const closed = resolveFeatureAccess(
      snapshot({
        now: new Date("2026-11-23T22:00:00.000Z"),
        passes,
      }),
    );
    expect(closed.tournament).toBe(false);
    expect(closed.tournamentGrace).toBe(false);
  });

  it("adds the grace only after the last day of a consecutive run", () => {
    const passes = [{ startsOn: "2026-11-23", endsOn: "2026-11-24" }];
    const stillOpen = resolveFeatureAccess(
      snapshot({
        now: new Date("2026-11-24T21:00:00.000Z"),
        passes,
      }),
    );
    expect(stillOpen.tournament).toBe(true);
    expect(stillOpen.tournamentGrace).toBe(true);
    expect(stillOpen.tournamentThrough).toBe("2026-11-24");

    const closed = resolveFeatureAccess(
      snapshot({
        now: new Date("2026-11-24T22:00:00.000Z"),
        passes,
      }),
    );
    expect(closed.tournament).toBe(false);
  });

  it("closes the gap between dates that are not in a row", () => {
    const passes = [
      { startsOn: "2026-11-23", endsOn: "2026-11-23" },
      { startsOn: "2026-11-25", endsOn: "2026-11-25" },
    ];
    const afterFirst = resolveFeatureAccess(
      snapshot({
        now: new Date("2026-11-23T23:00:00.000Z"),
        passes,
      }),
    );
    expect(afterFirst.tournament).toBe(false);

    const beforeSecondEnds = resolveFeatureAccess(
      snapshot({
        now: new Date("2026-11-25T19:00:00.000Z"),
        passes,
      }),
    );
    expect(beforeSecondEnds.tournament).toBe(true);
    expect(beforeSecondEnds.tournamentGrace).toBe(true);
    expect(beforeSecondEnds.tournamentThrough).toBe("2026-11-25");
  });

  it("keeps the purchased morning itself open before 6:00 AM", () => {
    const access = resolveFeatureAccess(
      snapshot({
        now: new Date("2026-11-22T19:00:00.000Z"),
        passes: [{ startsOn: "2026-11-23", endsOn: "2026-11-23" }],
      }),
    );
    expect(access.tournament).toBe(true);
    expect(access.tournamentGrace).toBe(false);
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
