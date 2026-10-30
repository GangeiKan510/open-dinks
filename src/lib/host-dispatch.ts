import type { PlayerGender, SessionMode } from "@/engine";
import type { SkillTier } from "@/lib/skill-tier";

export type HostDispatch =
  | { type: "FILL_COURTS"; courtIds?: string[] }
  | { type: "PUSH_TO_COURT"; courtId: string }
  | { type: "REORDER_WAITING_QUEUE"; playerIds: string[] }
  | {
      type: "MOVE_WAITING_QUEUE";
      playerId: string;
      direction: "up" | "down";
    }
  | { type: "START_MATCH"; matchId: string }
  | { type: "RETURN_TO_STACK"; matchId: string }
  | {
      type: "COMPLETE_MATCH";
      matchId: string;
      winner: "a" | "b";
      scoreA?: number | null;
      scoreB?: number | null;
    }
  | { type: "SET_MODE"; mode: SessionMode }
  | { type: "SHUFFLE_TEAMS"; matchId: string }
  | {
      type: "CHECK_IN";
      name: string;
      skill: SkillTier;
      gender?: PlayerGender | null;
      playerId: string;
    }
  | {
      type: "SET_GENDER";
      playerId: string;
      gender: PlayerGender | null;
    }
  | { type: "SET_MAX_GAME_MINUTES"; minutes: number | null }
  | {
      type: "SET_STATUS";
      playerId: string;
      status: "waiting" | "resting" | "left";
    }
  | {
      type: "SET_PARTNER_LOCK";
      playerId: string;
      partnerId: string | null;
    }
  | { type: "SET_TEAM_LOCK"; playerIds: string[] }
  | { type: "CLEAR_TEAM_LOCK"; playerId: string };

type MatchList = { matches: Array<{ id: string }> };

/** Match ids that exist on `after` and not on `before`, in list order. */
export function createdMatchIds(before: MatchList, after: MatchList): string[] {
  const previous = new Set(before.matches.map((match) => match.id));
  return after.matches
    .filter((match) => !previous.has(match.id))
    .map((match) => match.id);
}

/**
 * The client and server each generate their own match ids. Rename the server's
 * new matches to the ids the client already rendered so a follow-up action can
 * target the same match before the database uuid comes back.
 */
export function renameNewMatches<T extends MatchList>(
  before: MatchList,
  after: T,
  clientMatchIds: readonly string[],
): T {
  if (clientMatchIds.length === 0) return after;
  const created = createdMatchIds(before, after);
  if (created.length !== clientMatchIds.length) return after;
  const rename = new Map(
    created.map((id, index) => [id, clientMatchIds[index]]),
  );
  return {
    ...after,
    matches: after.matches.map((match) => {
      const id = rename.get(match.id);
      return id ? { ...match, id } : match;
    }),
  };
}

function resolveId(id: string, ids: ReadonlyMap<string, string>): string {
  return ids.get(id) ?? id;
}

/** Rewrite ids that were created on the client and then saved under a uuid. */
export function remapHostDispatch(
  action: HostDispatch,
  ids: ReadonlyMap<string, string>,
): HostDispatch {
  switch (action.type) {
    case "REORDER_WAITING_QUEUE":
    case "SET_TEAM_LOCK":
      return {
        ...action,
        playerIds: action.playerIds.map((id) => resolveId(id, ids)),
      };
    case "MOVE_WAITING_QUEUE":
    case "SET_GENDER":
    case "SET_STATUS":
    case "CLEAR_TEAM_LOCK":
      return { ...action, playerId: resolveId(action.playerId, ids) };
    case "SET_PARTNER_LOCK":
      return {
        ...action,
        playerId: resolveId(action.playerId, ids),
        partnerId: action.partnerId ? resolveId(action.partnerId, ids) : null,
      };
    case "START_MATCH":
    case "RETURN_TO_STACK":
    case "SHUFFLE_TEAMS":
      return { ...action, matchId: resolveId(action.matchId, ids) };
    case "COMPLETE_MATCH":
      return { ...action, matchId: resolveId(action.matchId, ids) };
    default:
      return action;
  }
}
