import { describe, expect, it } from "vitest";
import { shouldRefreshAuthSession } from "./middleware-paths";

describe("shouldRefreshAuthSession", () => {
  it("skips the marketing home page and local demos", () => {
    expect(shouldRefreshAuthSession("/")).toBe(false);
    expect(shouldRefreshAuthSession("/demo")).toBe(false);
    expect(shouldRefreshAuthSession("/demo/host")).toBe(false);
  });

  it("refreshes cookies on signed-in and booking routes", () => {
    expect(shouldRefreshAuthSession("/dashboard")).toBe(true);
    expect(shouldRefreshAuthSession("/login")).toBe(true);
    expect(shouldRefreshAuthSession("/book/pickle-grounds")).toBe(true);
    expect(shouldRefreshAuthSession("/s/abc/host")).toBe(true);
  });
});
