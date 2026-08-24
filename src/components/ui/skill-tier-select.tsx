import type { SkillTier } from "@/lib/skill-tier";
import { SKILL_TIERS, formatSkillTier } from "@/lib/skill-tier";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function SkillTierSelect({
  id,
  name,
  value,
  onChange,
  className,
}: {
  id: string;
  name?: string;
  value: SkillTier;
  onChange: (tier: SkillTier) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={id}>Skill level</Label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value as SkillTier)}
        className="flex h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
      >
        {SKILL_TIERS.map((tier) => (
          <option key={tier} value={tier}>
            {formatSkillTier(tier)}
          </option>
        ))}
      </select>
    </div>
  );
}
