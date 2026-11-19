import { describe, expect, it } from "vitest";
import { buildAccountRoster, rosterLimitNote } from "./admin-roster";

const NOW = new Date("2026-11-18T02:00:00.000Z");

describe("account roster", () => {
  it("marks operators, hosts, players, and accounts that have no club yet", () => {
    const rows = buildAccountRoster({
      now: NOW,
      operatorIds: ["op"],
      names: [
        { id: "op", displayName: "Sean" },
        { id: "host", displayName: "Ava" },
        { id: "player", displayName: "" },
      ],
      billing: [
        {
          facilityId: "fac",
          trialEndsAt: "2026-11-25T02:00:00.000Z",
          clubStatus: "none",
          clubPeriodEnd: null,
        },
      ],
      memberships: [
        {
          userId: "host",
          role: "owner",
          venueName: "PicklePlace",
          facilityId: "fac",
          timeZone: "Asia/Manila",
        },
      ],
      users: [
        {
          id: "host",
          email: "ava@club.test",
          createdAt: "2026-11-02T00:00:00.000Z",
          lastSignInAt: "2026-11-18T00:00:00.000Z",
          provider: "email",
        },
        {
          id: "op",
          email: "sean@picklrz.test",
          createdAt: "2026-11-18T00:00:00.000Z",
          lastSignInAt: null,
          provider: "email",
        },
        {
          id: "player",
          email: "jules@gmail.test",
          createdAt: "2026-11-10T00:00:00.000Z",
          lastSignInAt: null,
          provider: "google",
        },
        {
          id: "new",
          email: null,
          createdAt: "2026-11-12T00:00:00.000Z",
          lastSignInAt: null,
          provider: "email",
        },
      ],
    });

    expect(rows.map((row) => [row.id, row.kind, row.displayName])).toEqual([
      ["op", "operator", "Sean"],
      ["new", "account", "Unnamed"],
      ["player", "player", "Unnamed"],
      ["host", "host", "Ava"],
    ]);
    expect(rows[3]?.venues).toEqual([
      { name: "PicklePlace", role: "owner", plan: "Trial · 7 days" },
    ]);
    expect(rows[1]?.email).toBe("");
  });

  it("labels a club that has not chosen a plan yet", () => {
    const rows = buildAccountRoster({
      now: NOW,
      operatorIds: [],
      names: [],
      billing: [
        {
          facilityId: "fac",
          trialEndsAt: null,
          clubStatus: "none",
          clubPeriodEnd: null,
          choiceMade: false,
        },
      ],
      memberships: [
        {
          userId: "host",
          role: "owner",
          venueName: "PicklePlace",
          facilityId: "fac",
          timeZone: "Asia/Manila",
        },
      ],
      users: [
        {
          id: "host",
          email: "ava@club.test",
          createdAt: "2026-11-02T00:00:00.000Z",
          lastSignInAt: null,
          provider: "email",
        },
      ],
    });

    expect(rows[0]?.venues[0]?.plan).toBe("Choosing a plan");
  });

  it("says when the list is shorter than the directory", () => {
    expect(rosterLimitNote(200, 240)).toBe("Showing 200 of 240 accounts.");
    expect(rosterLimitNote(3, 3)).toBeNull();
    expect(rosterLimitNote(3, null)).toBeNull();
  });
});
