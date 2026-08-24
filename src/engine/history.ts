import { pairKey } from "@/lib/utils";

export function bump(
  history: Record<string, number>,
  a: string,
  b: string,
): Record<string, number> {
  const key = pairKey(a, b);
  return { ...history, [key]: (history[key] ?? 0) + 1 };
}

export function count(
  history: Record<string, number>,
  a: string,
  b: string,
): number {
  return history[pairKey(a, b)] ?? 0;
}

export function recordMatchPairings(
  partnerHistory: Record<string, number>,
  opponentHistory: Record<string, number>,
  teamA: string[],
  teamB: string[],
): {
  partnerHistory: Record<string, number>;
  opponentHistory: Record<string, number>;
} {
  let partners = { ...partnerHistory };
  let opponents = { ...opponentHistory };

  for (let i = 0; i < teamA.length; i++) {
    for (let j = i + 1; j < teamA.length; j++) {
      partners = bump(partners, teamA[i], teamA[j]);
    }
  }
  for (let i = 0; i < teamB.length; i++) {
    for (let j = i + 1; j < teamB.length; j++) {
      partners = bump(partners, teamB[i], teamB[j]);
    }
  }
  for (const a of teamA) {
    for (const b of teamB) {
      opponents = bump(opponents, a, b);
    }
  }

  return { partnerHistory: partners, opponentHistory: opponents };
}
