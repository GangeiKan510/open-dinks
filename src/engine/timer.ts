import type { EngineMatch } from "./types";

export function matchElapsedMs(match: EngineMatch, now: number): number | null {
  if (match.status !== "active" || match.startedAt == null) return null;
  return Math.max(0, now - match.startedAt);
}

export function matchRemainingMs(
  match: EngineMatch,
  maxGameMinutes: number,
  now: number,
): number | null {
  const elapsed = matchElapsedMs(match, now);
  if (elapsed == null) return null;
  return Math.max(0, maxGameMinutes * 60_000 - elapsed);
}

export function isMatchOvertime(
  match: EngineMatch,
  maxGameMinutes: number,
  now: number,
): boolean {
  const elapsed = matchElapsedMs(match, now);
  if (elapsed == null) return false;
  return elapsed >= maxGameMinutes * 60_000;
}

/** Formats milliseconds as m:ss (elapsed or remaining). */
export function formatTimer(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function clampMaxGameMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return 15;
  return Math.min(60, Math.max(1, Math.round(minutes)));
}
