import { describe, expect, it } from "vitest";
import {
  buildCoachHourlySlotGrid,
  coachIsAvailableAtHour,
  coachingSessionPriceCents,
  courtsAvailableForRange,
  groupAvailabilityByHours,
  parseAvailabilityFromForm,
  parsePublicCoaches,
  validateAvailabilityWindow,
  weekdayIndexForDayKey,
} from "./coaching";

const MANILA = "Asia/Manila";

describe("validateAvailabilityWindow", () => {
  it("accepts a normal weekday window", () => {
    expect(validateAvailabilityWindow(1, 9, 17)).toBe(true);
  });

  it("rejects inverted or out-of-range windows", () => {
    expect(validateAvailabilityWindow(1, 17, 9)).toBe(false);
    expect(validateAvailabilityWindow(7, 9, 17)).toBe(false);
    expect(validateAvailabilityWindow(1, 9, 9)).toBe(false);
  });
});

describe("coachIsAvailableAtHour", () => {
  const windows = [
    { dayOfWeek: 1, startHour: 9, endHour: 12 },
    { dayOfWeek: 3, startHour: 14, endHour: 18 },
  ];

  it("matches inclusive start and exclusive end", () => {
    expect(coachIsAvailableAtHour(windows, 1, 9)).toBe(true);
    expect(coachIsAvailableAtHour(windows, 1, 11)).toBe(true);
    expect(coachIsAvailableAtHour(windows, 1, 12)).toBe(false);
    expect(coachIsAvailableAtHour(windows, 3, 14)).toBe(true);
    expect(coachIsAvailableAtHour(windows, 2, 10)).toBe(false);
  });
});

describe("groupAvailabilityByHours", () => {
  it("merges weekdays that share the same hours", () => {
    expect(
      groupAvailabilityByHours([
        { dayOfWeek: 3, startHour: 9, endHour: 17 },
        { dayOfWeek: 1, startHour: 9, endHour: 17 },
        { dayOfWeek: 5, startHour: 10, endHour: 14 },
      ]),
    ).toEqual([
      { days: [1, 3], startHour: 9, endHour: 17 },
      { days: [5], startHour: 10, endHour: 14 },
    ]);
  });
});

describe("weekdayIndexForDayKey", () => {
  it("returns Sunday=0 for a known Manila calendar day", () => {
    // 2026-09-06 is a Sunday in Asia/Manila.
    expect(weekdayIndexForDayKey("2026-09-06", MANILA)).toBe(0);
    expect(weekdayIndexForDayKey("2026-09-07", MANILA)).toBe(1);
  });
});

describe("coachingSessionPriceCents", () => {
  it("multiplies hourly rate by hours", () => {
    expect(coachingSessionPriceCents(150000, 2)).toBe(300000);
    expect(coachingSessionPriceCents(0, 3)).toBe(0);
  });
});

describe("buildCoachHourlySlotGrid", () => {
  it("only emits slots inside coach availability and marks overlaps taken", () => {
    const fromMs = Date.parse("2026-09-07T00:00:00+08:00"); // Monday Manila
    const grid = buildCoachHourlySlotGrid(
      [
        {
          id: "coach-1",
          name: "Alex",
          availability: [{ dayOfWeek: 1, startHour: 9, endHour: 11 }],
        },
      ],
      [
        {
          coach_id: "coach-1",
          starts_at: "2026-09-07T01:00:00.000Z", // 9:00 AM Manila
          ends_at: "2026-09-07T02:00:00.000Z",
          status: "confirmed",
        },
      ],
      {
        fromMs,
        dayCount: 1,
        timeZone: MANILA,
        now: fromMs,
        openHour: 8,
        closeHour: 12,
      },
    );

    const monday = grid.slots.filter((s) => s.dayKey === "2026-09-07");
    expect(monday.map((s) => s.hour)).toEqual([9, 10]);
    expect(monday.find((s) => s.hour === 9)?.status).toBe("booked");
    expect(monday.find((s) => s.hour === 10)?.status).toBe("available");
  });
});

describe("parseAvailabilityFromForm", () => {
  it("parses parallel day/start/end fields", () => {
    const form = new FormData();
    form.append("availabilityDay", "1");
    form.append("availabilityStart", "9");
    form.append("availabilityEnd", "12");
    form.append("availabilityDay", "3");
    form.append("availabilityStart", "14");
    form.append("availabilityEnd", "18");
    expect(parseAvailabilityFromForm(form)).toEqual([
      { dayOfWeek: 1, startHour: 9, endHour: 12 },
      { dayOfWeek: 3, startHour: 14, endHour: 18 },
    ]);
  });

  it("rejects mismatched field counts", () => {
    const form = new FormData();
    form.append("availabilityDay", "1");
    form.append("availabilityStart", "9");
    expect(parseAvailabilityFromForm(form)).toBe("invalid");
  });
});

describe("parsePublicCoaches", () => {
  it("keeps active coach payloads and drops bad windows", () => {
    expect(
      parsePublicCoaches([
        {
          id: "c1",
          name: "Alex",
          rateCents: 150000,
          availability: [
            { dayOfWeek: 1, startHour: 9, endHour: 12 },
            { dayOfWeek: 9, startHour: 1, endHour: 2 },
          ],
        },
        { id: 2, name: "bad" },
      ]),
    ).toEqual([
      {
        id: "c1",
        name: "Alex",
        rateCents: 150000,
        availability: [{ dayOfWeek: 1, startHour: 9, endHour: 12 }],
      },
    ]);
  });
});

describe("courtsAvailableForRange", () => {
  it("excludes courts with overlapping busy windows", () => {
    const courts = [
      { id: "c1", name: "Court 1" },
      { id: "c2", name: "Court 2" },
    ];
    const start = Date.parse("2026-09-07T01:00:00.000Z");
    const end = Date.parse("2026-09-07T02:00:00.000Z");
    expect(
      courtsAvailableForRange(
        courts,
        [
          {
            court_id: "c1",
            starts_at: "2026-09-07T01:00:00.000Z",
            ends_at: "2026-09-07T02:00:00.000Z",
          },
        ],
        start,
        end,
      ).map((c) => c.id),
    ).toEqual(["c2"]);
  });
});
