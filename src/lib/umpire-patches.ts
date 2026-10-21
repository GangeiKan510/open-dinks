import type { TournamentEvent, TournamentMatch } from "@/engine/tournament";

/** Fields an umpire save may change on a match. Anything else stays on the server. */
const MATCH_PATCH_KEYS = [
  "stage",
  "groupId",
  "round",
  "slot",
  "number",
  "courtNumber",
  "teamAId",
  "teamBId",
  "games",
  "status",
  "nextMatchId",
  "nextSlot",
  "loserNextMatchId",
  "loserNextSlot",
  "placement",
  "live",
  "claim",
] as const satisfies readonly (keyof TournamentMatch)[];

export type MatchPatchKey = (typeof MATCH_PATCH_KEYS)[number];

export interface MatchFieldPatch {
  categoryId: string;
  matchId: string;
  /** Keys this phone changed. Omitted keys stay as already saved. */
  set: Partial<Record<MatchPatchKey, unknown>>;
  /** Present when this action created the match. */
  insert?: TournamentMatch;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

/**
 * Changes between two copies of the event. A court only sends the keys it
 * changed, so another court's score is not part of the write.
 */
export function matchFieldPatches(
  before: TournamentEvent,
  after: TournamentEvent,
): MatchFieldPatch[] {
  const patches: MatchFieldPatch[] = [];
  for (const category of after.categories) {
    const previous = before.categories.find((item) => item.id === category.id);
    const previousMatches = new Map(
      (previous?.matches ?? []).map((match) => [match.id, match]),
    );
    for (const match of category.matches) {
      const prior = previousMatches.get(match.id);
      if (!prior) {
        patches.push({
          categoryId: category.id,
          matchId: match.id,
          set: {},
          insert: match,
        });
        continue;
      }
      const set: Partial<Record<MatchPatchKey, unknown>> = {};
      for (const key of MATCH_PATCH_KEYS) {
        const nextValue = match[key] ?? null;
        if (!sameJson(prior[key] ?? null, nextValue)) {
          set[key] = nextValue;
        }
      }
      if (Object.keys(set).length > 0) {
        patches.push({ categoryId: category.id, matchId: match.id, set });
      }
    }
  }
  return patches;
}

/** True when `candidate` is a later tournament write than `current`. */
export function isNewerTimestamp(candidate: string, current: string): boolean {
  const next = Date.parse(candidate);
  const previous = Date.parse(current);
  if (Number.isNaN(next)) return false;
  if (Number.isNaN(previous)) return true;
  return next > previous;
}
