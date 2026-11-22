import { describe, expect, it } from "vitest";
import { buildActivityFeed, type ActivitySource } from "./admin-activity";

const EMPTY: ActivitySource = {
  profiles: [],
  venues: [],
  sessions: [],
  bookings: [],
  coaching: [],
  tournaments: [],
  payments: [],
  feedback: [],
};

describe("activity feed", () => {
  it("orders events by time and keeps the newest rows", () => {
    const feed = buildActivityFeed(
      {
        ...EMPTY,
        profiles: [
          {
            id: "old",
            displayName: "Ava",
            createdAt: "2026-11-01T00:00:00.000Z",
          },
        ],
        sessions: [
          {
            id: "live",
            title: "Monday Open Play",
            status: "live",
            createdAt: "2026-11-18T01:00:00.000Z",
            venueName: "PicklePlace",
            actorName: "Ava",
          },
        ],
        feedback: [{ id: "note", createdAt: "2026-11-18T02:00:00.000Z" }],
      },
      2,
    );

    expect(feed.map((item) => item.id)).toEqual([
      "feedback-note",
      "session-live",
    ]);
    expect(feed[1]).toMatchObject({
      title: "Open play is live",
      detail: "Monday Open Play · PicklePlace · Ava",
    });
    expect(feed[0]?.detail).toBe("No name attached");
  });

  it("labels public court requests separately from staff bookings", () => {
    const feed = buildActivityFeed({
      ...EMPTY,
      bookings: [
        {
          id: "public",
          name: "Jules",
          status: "pending",
          source: "public",
          createdAt: "2026-11-18T00:00:00.000Z",
          venueName: "North",
        },
        {
          id: "staff",
          name: "",
          status: "confirmed",
          source: "staff",
          createdAt: "2026-11-17T00:00:00.000Z",
          venueName: "North",
        },
      ],
      payments: [
        {
          id: "pay",
          createdAt: "2026-11-16T00:00:00.000Z",
          facilityName: "North",
          kind: "day",
          amountCentavos: null,
        },
      ],
    });

    expect(feed.map((item) => item.title)).toEqual([
      "Court requested",
      "Court booked",
      "Paid ₱2,000",
    ]);
    expect(feed[1]?.detail).toBe("A player · North · confirmed");
    expect(feed[2]?.detail).toBe("Tournament day · North");
  });
});
