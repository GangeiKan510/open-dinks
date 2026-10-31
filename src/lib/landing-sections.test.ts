import { describe, expect, it } from "vitest";
import { activeLandingSection } from "./landing-sections";

const sections = [
  { id: "open-play", top: 400 },
  { id: "tournament", top: 1200 },
  { id: "court-rentals", top: 2200 },
];

describe("activeLandingSection", () => {
  it("stays on the first section until the next one reaches the bar", () => {
    expect(
      activeLandingSection(
        [
          { id: "open-play", top: -200 },
          { id: "tournament", top: 180 },
          { id: "court-rentals", top: 900 },
        ],
        96,
      ),
    ).toBe("open-play");
  });

  it("selects the last section whose top has crossed the bar", () => {
    expect(
      activeLandingSection(
        [
          { id: "open-play", top: -1400 },
          { id: "tournament", top: 40 },
          { id: "court-rentals", top: 800 },
        ],
        96,
      ),
    ).toBe("tournament");
  });

  it("selects the last section once the page cannot scroll further", () => {
    expect(activeLandingSection(sections, 96, true)).toBe("court-rentals");
  });

  it("returns an empty string when there are no sections", () => {
    expect(activeLandingSection([], 96)).toBe("");
  });
});
