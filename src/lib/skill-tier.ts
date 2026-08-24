export const SKILL_TIERS = [
  "beginner",
  "novice",
  "intermediate",
  "advanced",
] as const;

export type SkillTier = (typeof SKILL_TIERS)[number];

export const DEFAULT_SKILL_TIER: SkillTier = "intermediate";

export const SKILL_TIER_LABELS: Record<SkillTier, string> = {
  beginner: "Beginner",
  novice: "Novice",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export function skillTierRank(tier: SkillTier): number {
  return SKILL_TIERS.indexOf(tier) + 1;
}

export function skillTierFromRank(rank: number): SkillTier {
  const idx = Math.min(
    SKILL_TIERS.length - 1,
    Math.max(0, Math.round(rank) - 1),
  );
  return SKILL_TIERS[idx];
}

export function formatSkillTier(tier: SkillTier): string {
  return SKILL_TIER_LABELS[tier];
}

export function parseSkillTier(value: string | null | undefined): SkillTier {
  const normalized = value?.toLowerCase().trim();
  if (normalized && SKILL_TIERS.includes(normalized as SkillTier)) {
    return normalized as SkillTier;
  }
  return DEFAULT_SKILL_TIER;
}

/** True when player tier is within court band (inclusive). */
export function playerMatchesSkillBand(
  playerTier: SkillTier,
  skillMin?: SkillTier,
  skillMax?: SkillTier,
): boolean {
  if (!skillMin && !skillMax) return true;
  const rank = skillTierRank(playerTier);
  const min = skillMin ? skillTierRank(skillMin) : 1;
  const max = skillMax ? skillTierRank(skillMax) : SKILL_TIERS.length;
  return rank >= min && rank <= max;
}

export function formatSkillBand(
  skillMin?: SkillTier | null,
  skillMax?: SkillTier | null,
): string {
  if (!skillMin && !skillMax) return "Any skill";
  if (skillMin && skillMax && skillMin === skillMax) {
    return formatSkillTier(skillMin);
  }
  if (skillMin && skillMax) {
    return `${formatSkillTier(skillMin)} – ${formatSkillTier(skillMax)}`;
  }
  if (skillMin) return `${formatSkillTier(skillMin)}+`;
  if (skillMax) return `Up to ${formatSkillTier(skillMax)}`;
  return "Any skill";
}
