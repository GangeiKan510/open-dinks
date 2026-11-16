import { describe, expect, it } from "vitest";
import { scoreboardQrDownloadName } from "./scoreboard-qr";

describe("scoreboardQrDownloadName", () => {
  it("builds a filename from the tournament name", () => {
    expect(scoreboardQrDownloadName("Mixed 3.5")).toBe("mixed-3-5-qr.png");
  });

  it("drops punctuation and falls back when the name is empty", () => {
    expect(scoreboardQrDownloadName("Club's Cup!")).toBe("club-s-cup-qr.png");
    expect(scoreboardQrDownloadName("   ")).toBe("scoreboard-qr.png");
  });
});
