import { describe, expect, it } from "vitest";
import { formatVenueTimezoneLabel, parseVenueTimezone } from "@/lib/timezone";

describe("parseVenueTimezone", () => {
  it("accepts a valid IANA timezone", () => {
    expect(parseVenueTimezone("Asia/Manila")).toBe("Asia/Manila");
  });

  it("falls back to UTC for invalid input", () => {
    expect(parseVenueTimezone("Not/A_Zone")).toBe("UTC");
    expect(parseVenueTimezone("")).toBe("UTC");
    expect(parseVenueTimezone(null)).toBe("UTC");
  });
});

describe("formatVenueTimezoneLabel", () => {
  it("includes the IANA id", () => {
    expect(formatVenueTimezoneLabel("Asia/Manila")).toContain("Asia/Manila");
  });
});
