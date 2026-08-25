import type { SkillTier } from "@/lib/skill-tier";

export type SessionMode =
  "rotating" | "skill_separated" | "king_of_court" | "singles";

export type PlayerStatus = "waiting" | "playing" | "resting" | "left";

export type MatchStatus = "ready" | "active" | "completed";

export interface EngineCourt {
  id: string;
  name: string;
  /** Optional skill band for skill_separated mode (inclusive). */
  skillMin?: SkillTier;
  skillMax?: SkillTier;
}

export interface EnginePlayer {
  id: string;
  name: string;
  skill: SkillTier;
  status: PlayerStatus;
  gamesPlayed: number;
  lastPlayedAt: number | null;
  checkedInAt: number;
  partnerLockId?: string | null;
  /** Shared id for a fixed foursome (doubles) that must play together. */
  teamLockGroupId?: string | null;
  avoidIds?: string[];
  /** Consecutive wins while staying on court (king of the court). */
  consecutiveWins?: number;
  /** Host-defined position in the waiting stack (lower = closer to the front). */
  queueOrder?: number;
}

export interface EngineMatch {
  id: string;
  courtId: string;
  courtName: string;
  teamA: string[];
  teamB: string[];
  status: MatchStatus;
  winner?: "a" | "b" | null;
  /** Set when the host starts the court timer. */
  startedAt: number | null;
  endedAt?: number | null;
}

export interface EngineState {
  mode: SessionMode;
  courts: EngineCourt[];
  players: EnginePlayer[];
  matches: EngineMatch[];
  /** Sorted pair key → times partnered. */
  partnerHistory: Record<string, number>;
  /** Sorted pair key → times opposed. */
  opponentHistory: Record<string, number>;
  now: number;
  /** Cap for king-of-court consecutive wins before forced rotate. */
  kingMaxConsecutiveWins: number;
  /** Max game length in minutes before the timer stops at zero. */
  maxGameMinutes: number;
}

export type EngineAction =
  | { type: "TICK"; now: number }
  | { type: "SET_MODE"; mode: SessionMode }
  | { type: "SET_MAX_GAME_MINUTES"; minutes: number }
  | {
      type: "CHECK_IN";
      player: Omit<
        EnginePlayer,
        | "status"
        | "gamesPlayed"
        | "lastPlayedAt"
        | "checkedInAt"
        | "consecutiveWins"
      >;
    }
  | { type: "SET_STATUS"; playerId: string; status: PlayerStatus }
  | { type: "SET_PARTNER_LOCK"; playerId: string; partnerId: string | null }
  | { type: "SET_TEAM_LOCK"; playerIds: string[] }
  | { type: "CLEAR_TEAM_LOCK"; playerId: string }
  | { type: "SET_AVOID"; playerId: string; avoidIds: string[] }
  | { type: "FILL_COURTS"; courtIds?: string[] }
  | {
      type: "REORDER_WAITING_QUEUE";
      playerIds: string[];
    }
  | {
      type: "MOVE_WAITING_QUEUE";
      playerId: string;
      direction: "up" | "down";
    }
  | { type: "PUSH_TO_COURT"; courtId: string }
  | { type: "START_MATCH"; matchId: string }
  | { type: "RETURN_TO_STACK"; matchId: string }
  | { type: "COMPLETE_MATCH"; matchId: string; winner: "a" | "b" }
  | {
      type: "FORCE_ASSIGN";
      courtId: string;
      teamA: string[];
      teamB: string[];
    }
  | { type: "SWAP_PLAYERS"; playerIdA: string; playerIdB: string }
  | { type: "SHUFFLE_TEAMS"; matchId: string };

export interface SessionSummary {
  playerId: string;
  name: string;
  gamesPlayed: number;
  wins: number;
  skill: SkillTier;
}
