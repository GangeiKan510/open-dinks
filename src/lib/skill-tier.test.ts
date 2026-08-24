import { describe, expect, it } from "vitest";
import {
  DEFAULT_SKILL_TIER,
  formatSkillBand,
  formatSkillTier,
  parseSkillTier,
  playerMatchesSkillBand,
  skillTierFromRank,
  skillTierRank,
} from "./skill-tier";

describe("skill tiers", () => {
  it("ranks tiers in order", () => {
    expect(skillTierRank("beginner")).toBe(1);
    expect(skillTierRank("advanced")).toBe(4);
    expect(skillTierFromRank(3)).toBe("intermediate");
  });

  it("formats labels", () => {
    expect(formatSkillTier("novice")).toBe("Novice");
  });

  it("parses valid tiers and falls back to default", () => {
    expect(parseSkillTier("Advanced")).toBe("advanced");
    expect(parseSkillTier("invalid")).toBe(DEFAULT_SKILL_TIER);
  });

  it("matches skill bands inclusively", () => {
    expect(playerMatchesSkillBand("novice", "beginner", "intermediate")).toBe(
      true,
    );
    expect(playerMatchesSkillBand("advanced", "beginner", "intermediate")).toBe(
      false,
    );
  });

  it("formats skill band copy", () => {
    expect(formatSkillBand("beginner", "novice")).toBe("Beginner – Novice");
    expect(formatSkillBand("advanced", "advanced")).toBe("Advanced");
    expect(formatSkillBand(null, null)).toBe("Any skill");
  });
});
