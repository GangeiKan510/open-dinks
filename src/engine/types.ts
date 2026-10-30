import type { SkillTier } from "@/lib/skill-tier";

export type SessionMode =
  | "rotating"
  | "skill_separated"
  | "king_of_court"
  | "singles"
  | "all_random"
  | "rated"
  | "court_kings"
  | "social_shuffle"
  | "couple_hunt";

/** Doubles or singles. Orthogonal to matchmaking mode. Legacy `singles` mode still means one player a side. */
export type GameFormat = "doubles" | "singles";

export type ScoreTracking = "winner" | "scores";

export type MatchingStyle = "auto" | "manual";

export type PlayerGender = "man" | "woman";

export type LastResult = "win" | "loss";

export type PlayerStatus = "waiting" | "playing" | "resting" | "left";

export type MatchStatus = "ready" | "active" | "completed";

/** A confirmed reservation that takes a court out of open play for its window. */
export interface EngineCourtBooking {
  id: string;
  /** Who reserved it, shown on the wallboard. */
  label: string;
  startsAt: number;
  /** Exclusive: a booking ending at `now` no longer blocks the court. */
  endsAt: number;
}

export interface EngineCourt {
  id: string;
  name: string;
  /** Optional skill band for skill_separated mode (inclusive). */
  skillMin?: SkillTier;
  skillMax?: SkillTier;
  /** Confirmed bookings overlapping the session window, ascending by start. */
  bookings?: EngineCourtBooking[];
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
  /** Couple Hunt only. Missing gender stays in the queue until the host sets it. */
  gender?: PlayerGender | null;
  /** Court Kings uses the previous match result to keep winners with winners. */
  lastResult?: LastResult | null;
}

export interface EngineMatch {
  id: string;
  courtId: string;
  courtName: string;
  teamA: string[];
  teamB: string[];
  status: MatchStatus;
  winner?: "a" | "b" | null;
  scoreA?: number | null;
  scoreB?: number | null;
  /** Set when the host starts the court timer. */
  startedAt: number | null;
  endedAt?: number | null;
}

export interface EngineState {
  mode: SessionMode;
  /** One player a side when `singles`. Defaults to doubles. */
  format: GameFormat;
  /** Winner buttons, or both scores. The higher score is the winner. */
  scoreTracking: ScoreTracking;
  /** After this many games a player rests. Null means they can keep queuing. */
  playerGameLimit: number | null;
  /** Auto fills open courts when the queue can. Manual waits for the host. */
  matching: MatchingStyle;
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
  /** Max game length in minutes. Null means the court is not called on a clock. */
  maxGameMinutes: number | null;
}

export type EngineAction =
  | { type: "TICK"; now: number }
  | { type: "SET_MODE"; mode: SessionMode }
  | { type: "SET_MAX_GAME_MINUTES"; minutes: number | null }
  | { type: "SET_GENDER"; playerId: string; gender: PlayerGender | null }
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
  | {
      type: "COMPLETE_MATCH";
      matchId: string;
      winner: "a" | "b";
      scoreA?: number | null;
      scoreB?: number | null;
    }
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
