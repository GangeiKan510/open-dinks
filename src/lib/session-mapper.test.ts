import { describe, expect, it } from "vitest";
import { dbToEngineState } from "@/lib/session-mapper";
import type { Database } from "@/lib/supabase/database.types";

type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
type CourtRow = Database["public"]["Tables"]["courts"]["Row"];

const baseSession: SessionRow = {
  id: "session-1",
  venue_id: "venue-1",
  title: "Open Play",
  public_token: "abc123",
  mode: "rotating",
  status: "live",
  court_count: 1,
  king_max_consecutive_wins: 3,
  max_game_minutes: 15,
  started_at: null,
  ended_at: null,
  created_by: null,
  created_at: new Date().toISOString(),
};

describe("session mapper courts", () => {
  it("supports a single-court session", () => {
    const courts: CourtRow[] = [
      {
        id: "court-1",
        venue_id: "venue-1",
        name: "Court 1",
        sort_order: 1,
        skill_min: null,
        skill_max: null,
        created_at: new Date().toISOString(),
      },
    ];

    const state = dbToEngineState({
      session: baseSession,
      players: [],
      matches: [],
      courts,
      pairings: [],
    });

    expect(state.courts).toHaveLength(1);
    expect(state.courts[0].name).toBe("Court 1");
  });

  it("pads virtual courts when a session uses more courts than the venue has saved", () => {
    const courts: CourtRow[] = [
      {
        id: "court-1",
        venue_id: "venue-1",
        name: "Court 1",
        sort_order: 1,
        skill_min: null,
        skill_max: null,
        created_at: new Date().toISOString(),
      },
    ];

    const state = dbToEngineState({
      session: { ...baseSession, court_count: 4 },
      players: [],
      matches: [],
      courts,
      pairings: [],
    });

    expect(state.courts).toHaveLength(4);
    expect(state.courts.map((court) => court.name)).toEqual([
      "Court 1",
      "Court 2",
      "Court 3",
      "Court 4",
    ]);
  });
});
