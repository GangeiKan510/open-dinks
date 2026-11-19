import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  parseTheme,
  resolveTheme,
  THEME_IDS,
} from "@/lib/theme";

describe("parseTheme", () => {
  it("accepts the account theme ids", () => {
    for (const id of THEME_IDS) {
      expect(parseTheme(id)).toBe(id);
    }
  });

  it("falls back to green for missing or unknown values", () => {
    expect(DEFAULT_THEME).toBe("green");
    expect(parseTheme(undefined)).toBe(DEFAULT_THEME);
    expect(parseTheme(null)).toBe(DEFAULT_THEME);
    expect(parseTheme("")).toBe(DEFAULT_THEME);
    expect(parseTheme("purple")).toBe(DEFAULT_THEME);
  });
});

describe("resolveTheme", () => {
  it("uses the cookie when the screen theme and the saved profile differ", () => {
    expect(resolveTheme("green", "court")).toBe("green");
    expect(resolveTheme(undefined, "red")).toBe("red");
    expect(resolveTheme("", "mono")).toBe("mono");
    expect(resolveTheme(null, null)).toBe(DEFAULT_THEME);
  });
});
