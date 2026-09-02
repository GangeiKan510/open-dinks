import { describe, expect, it } from "vitest";
import {
  activeCourtBooking,
  bookableCourts,
  isCourtBooked,
  nextCourtBooking,
} from "./bookings";
import { createInitialState, reduce } from "./reducer";
import { proposeFillCourts, getStackPushBlockReason } from "./matchmaking";
import type { EngineCourt, EngineCourtBooking, EnginePlayer } from "./types";

const NOON = new Date("2026-08-29T12:00:00Z").getTime();
const HOUR = 60 * 60 * 1000;

function booking(partial?: Partial<EngineCourtBooking>): EngineCourtBooking {
  return {
    id: "b1",
    label: "Rivera party",
    startsAt: NOON,
    endsAt: NOON + HOUR,
    ...partial,
  };
}

function court(id: string, bookings?: EngineCourtBooking[]): EngineCourt {
  return { id, name: `Court ${id}`, bookings };
}

function waitingPlayer(id: string): EnginePlayer {
  return {
    id,
    name: id.toUpperCase(),
    skill: "intermediate",
    status: "waiting",
    gamesPlayed: 0,
    lastPlayedAt: null,
    checkedInAt: NOON,
  };
}

describe("activeCourtBooking", () => {
  it("returns null when the court has no bookings", () => {
    expect(activeCourtBooking(court("c1"), NOON)).toBeNull();
    expect(activeCourtBooking(court("c1", []), NOON)).toBeNull();
  });

  it("matches at the exact start time", () => {
    const c = court("c1", [booking()]);
    expect(activeCourtBooking(c, NOON)?.id).toBe("b1");
  });

  it("frees the court at the exact end time so back-to-back slots do not overlap", () => {
    const c = court("c1", [
      booking({ id: "early", startsAt: NOON - HOUR, endsAt: NOON }),
      booking({ id: "late", startsAt: NOON, endsAt: NOON + HOUR }),
    ]);
    expect(activeCourtBooking(c, NOON)?.id).toBe("late");
  });

  it("ignores bookings that have not started yet", () => {
    const c = court("c1", [
      booking({ startsAt: NOON + HOUR, endsAt: NOON + 2 * HOUR }),
    ]);
    expect(isCourtBooked(c, NOON)).toBe(false);
  });
});

describe("nextCourtBooking", () => {
  it("returns the soonest future booking regardless of array order", () => {
    const c = court("c1", [
      booking({
        id: "later",
        startsAt: NOON + 5 * HOUR,
        endsAt: NOON + 6 * HOUR,
      }),
      booking({ id: "sooner", startsAt: NOON + HOUR, endsAt: NOON + 2 * HOUR }),
    ]);
    expect(nextCourtBooking(c, NOON)?.id).toBe("sooner");
  });

  it("ignores the booking currently in progress", () => {
    const c = court("c1", [booking()]);
    expect(nextCourtBooking(c, NOON)).toBeNull();
  });
});

describe("bookableCourts", () => {
  it("excludes courts booked at the current engine time", () => {
    const state = createInitialState({
      now: NOON,
      courts: [court("c1", [booking()]), court("c2")],
    });
    expect(bookableCourts(state).map((c) => c.id)).toEqual(["c2"]);
  });

  it("re-includes a court once its booking has ended", () => {
    const state = createInitialState({
      now: NOON + HOUR,
      courts: [court("c1", [booking()]), court("c2")],
    });
    expect(bookableCourts(state).map((c) => c.id)).toEqual(["c1", "c2"]);
  });
});

describe("open play assignment with bookings", () => {
  const players = ["p1", "p2", "p3", "p4"].map(waitingPlayer);

  it("does not propose a match on a booked court", () => {
    const state = createInitialState({
      now: NOON,
      courts: [court("c1", [booking()])],
      players,
    });
    expect(proposeFillCourts(state)).toEqual([]);
  });

  it("fills the next free court instead of the booked one", () => {
    const state = createInitialState({
      now: NOON,
      courts: [court("c1", [booking()]), court("c2")],
      players,
    });
    const proposals = proposeFillCourts(state);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].courtId).toBe("c2");
  });

  it("ignores PUSH_TO_COURT aimed at a booked court", () => {
    const state = createInitialState({
      now: NOON,
      courts: [court("c1", [booking()]), court("c2")],
      players,
    });
    const next = reduce(state, { type: "PUSH_TO_COURT", courtId: "c1" });
    expect(next.matches).toEqual([]);
    expect(next.players.every((p) => p.status === "waiting")).toBe(true);
  });

  it("ignores FORCE_ASSIGN aimed at a booked court", () => {
    const state = createInitialState({
      now: NOON,
      courts: [court("c1", [booking()])],
      players,
    });
    const next = reduce(state, {
      type: "FORCE_ASSIGN",
      courtId: "c1",
      teamA: ["p1", "p2"],
      teamB: ["p3", "p4"],
    });
    expect(next).toBe(state);
  });

  it("allows the push once the booking window has passed", () => {
    const state = createInitialState({
      now: NOON + HOUR,
      courts: [court("c1", [booking()])],
      players,
    });
    const next = reduce(state, { type: "PUSH_TO_COURT", courtId: "c1" });
    expect(next.matches).toHaveLength(1);
    expect(next.matches[0].courtId).toBe("c1");
  });

  it("reports no push blocker when every court is booked", () => {
    const state = createInitialState({
      now: NOON,
      courts: [court("c1", [booking()])],
      players,
    });
    expect(getStackPushBlockReason(state)).toBeNull();
  });
});
