import { describe, expect, it } from "vitest";
import { isLiveSessionRealtimeEvent } from "./session-realtime";

const session = { id: "session-1", venue_id: "venue-1" };

describe("isLiveSessionRealtimeEvent", () => {
  it("accepts player and match rows for this session", () => {
    expect(
      isLiveSessionRealtimeEvent(
        {
          table: "session_players",
          new: { id: "p1", session_id: "session-1" },
        },
        session,
      ),
    ).toBe(true);
    expect(
      isLiveSessionRealtimeEvent(
        {
          table: "matches",
          new: { id: "m1", session_id: "session-1" },
        },
        session,
      ),
    ).toBe(true);
  });

  it("ignores player and match rows from another session", () => {
    expect(
      isLiveSessionRealtimeEvent(
        {
          table: "session_players",
          new: { id: "p1", session_id: "session-other" },
        },
        session,
      ),
    ).toBe(false);
    expect(
      isLiveSessionRealtimeEvent(
        {
          table: "matches",
          old: { id: "m1", session_id: "session-other" },
        },
        session,
      ),
    ).toBe(false);
  });

  it("ignores booking rows from another venue", () => {
    expect(
      isLiveSessionRealtimeEvent(
        {
          table: "bookings",
          new: { id: "b1", venue_id: "venue-other" },
        },
        session,
      ),
    ).toBe(false);
    expect(
      isLiveSessionRealtimeEvent(
        {
          table: "coaching_bookings",
          new: { id: "c1", venue_id: "venue-1" },
        },
        session,
      ),
    ).toBe(true);
  });

  it("accepts this session row and ignores other sessions", () => {
    expect(
      isLiveSessionRealtimeEvent(
        { table: "sessions", new: { id: "session-1" } },
        session,
      ),
    ).toBe(true);
    expect(
      isLiveSessionRealtimeEvent(
        { table: "sessions", new: { id: "session-other" } },
        session,
      ),
    ).toBe(false);
  });

  it("refreshes when a delete payload has no scope column", () => {
    expect(
      isLiveSessionRealtimeEvent(
        { table: "session_players", old: { id: "p1" } },
        session,
      ),
    ).toBe(true);
  });

  it("uses the old row when new is an empty delete payload", () => {
    expect(
      isLiveSessionRealtimeEvent(
        {
          table: "session_players",
          new: {},
          old: { id: "p1", session_id: "session-other" },
        },
        session,
      ),
    ).toBe(false);
  });
});
