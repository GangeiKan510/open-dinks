import { describe, expect, it } from "vitest";
import {
  canonicalLiveSession,
  compareLiveSessions,
  type SessionRow,
} from "@/lib/live-session";

function session(
  overrides: Partial<SessionRow> & Pick<SessionRow, "id">,
): SessionRow {
  return {
    venue_id: "venue-1",
    title: "Open Play",
    public_token: overrides.id,
    mode: "rotating",
    status: "live",
    court_count: 4,
    king_max_consecutive_wins: 3,
    max_game_minutes: 12,
    started_at: null,
    ended_at: null,
    created_by: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("compareLiveSessions", () => {
  it("prefers the session that started most recently", () => {
    const older = session({
      id: "a",
      started_at: "2026-01-01T10:00:00Z",
    });
    const newer = session({
      id: "b",
      started_at: "2026-01-02T10:00:00Z",
    });
    expect(compareLiveSessions(newer, older)).toBeLessThan(0);
    expect(compareLiveSessions(older, newer)).toBeGreaterThan(0);
  });

  it("breaks ties on created_at", () => {
    const first = session({
      id: "a",
      started_at: "2026-01-01T10:00:00Z",
      created_at: "2026-01-01T09:00:00Z",
    });
    const second = session({
      id: "b",
      started_at: "2026-01-01T10:00:00Z",
      created_at: "2026-01-01T11:00:00Z",
    });
    expect(canonicalLiveSession([first, second])?.id).toBe("b");
  });
});

describe("canonicalLiveSession", () => {
  it("returns null when nothing is live", () => {
    expect(
      canonicalLiveSession([
        session({ id: "a", status: "completed" }),
        session({ id: "b", status: "scheduled" }),
      ]),
    ).toBeNull();
  });

  it("returns the newest live session when several are live", () => {
    const sessions = [
      session({ id: "old", started_at: "2026-01-01T10:00:00Z" }),
      session({ id: "new", started_at: "2026-01-03T10:00:00Z" }),
      session({ id: "mid", started_at: "2026-01-02T10:00:00Z" }),
    ];
    expect(canonicalLiveSession(sessions)?.id).toBe("new");
  });
});
