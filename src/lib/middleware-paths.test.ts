import { describe, expect, it } from "vitest";
import { shouldRefreshAuthSession } from "./middleware-paths";

describe("shouldRefreshAuthSession", () => {
  it("skips the marketing home page and public boards", () => {
    expect(shouldRefreshAuthSession("/")).toBe(false);
    expect(shouldRefreshAuthSession("/tournament/board")).toBe(false);
    expect(shouldRefreshAuthSession("/tournament/board/abc")).toBe(false);
    expect(shouldRefreshAuthSession("/tournament/umpire")).toBe(false);
    expect(shouldRefreshAuthSession("/tournament/umpire/abc")).toBe(false);
    expect(shouldRefreshAuthSession("/s/abc")).toBe(false);
    expect(shouldRefreshAuthSession("/s/abc/board")).toBe(false);
    expect(shouldRefreshAuthSession("/robots.txt")).toBe(false);
    expect(shouldRefreshAuthSession("/sitemap.xml")).toBe(false);
  });

  it("refreshes cookies on signed-in and booking routes", () => {
    expect(shouldRefreshAuthSession("/tournament")).toBe(true);
    expect(shouldRefreshAuthSession("/dashboard")).toBe(true);
    expect(shouldRefreshAuthSession("/login")).toBe(true);
    expect(shouldRefreshAuthSession("/book/pickle-grounds")).toBe(true);
    expect(shouldRefreshAuthSession("/s/abc/host")).toBe(true);
  });
});
