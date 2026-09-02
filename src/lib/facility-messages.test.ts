import { describe, expect, it } from "vitest";
import { formatCourtInUseMessage } from "@/lib/facility-messages";

describe("formatCourtInUseMessage", () => {
  it("names the booked court and the fix", () => {
    expect(formatCourtInUseMessage("Court 4", "booked")).toBe(
      "Court 4 has an upcoming booking. Cancel it before reducing your court count.",
    );
  });

  it("distinguishes a game in progress from a booking", () => {
    expect(formatCourtInUseMessage("Court 4", "playing")).toBe(
      "Court 4 has a game in progress. Finish it before reducing your court count.",
    );
  });

  it("falls back to a generic subject when the name is missing", () => {
    expect(formatCourtInUseMessage("   ", "booked")).toBe(
      "That court has an upcoming booking. Cancel it before reducing your court count.",
    );
  });
});
