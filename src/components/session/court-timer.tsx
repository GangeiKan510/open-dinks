"use client";

import { useEffect, useState } from "react";
import type { EngineMatch } from "@/engine";
import {
  formatTimer,
  isMatchOvertime,
  matchElapsedMs,
  matchRemainingMs,
} from "@/engine";
import { cn } from "@/lib/utils";

export function CourtTimer({
  match,
  maxGameMinutes,
  compact = false,
  tone = "light",
}: {
  match: EngineMatch;
  maxGameMinutes: number;
  compact?: boolean;
  tone?: "light" | "dark";
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (match.status !== "active") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [match.status, match.id, match.startedAt]);

  const muted = tone === "dark" ? "text-white/50" : "text-[var(--muted)]";
  const fg =
    tone === "dark" ? "text-[var(--paper)]" : "text-[var(--foreground)]";
  const ended = tone === "dark" ? "text-[var(--lime)]" : "text-amber-700";

  if (match.status === "ready") {
    return (
      <div
        className={cn(
          "font-mono tabular-nums",
          muted,
          compact ? "text-sm" : "text-lg",
        )}
      >
        Ready · {maxGameMinutes}:00 max
      </div>
    );
  }

  if (match.status !== "active") return null;

  const elapsed = matchElapsedMs(match, now) ?? 0;
  const remaining = matchRemainingMs(match, maxGameMinutes, now) ?? 0;
  const timeUp = isMatchOvertime(match, maxGameMinutes, now);
  const maxMs = maxGameMinutes * 60_000;
  const displayElapsed = Math.min(elapsed, maxMs);

  return (
    <div
      className={cn(
        "font-mono tabular-nums",
        compact ? "text-sm" : "text-2xl font-semibold",
        timeUp ? ended : fg,
      )}
      aria-live="polite"
    >
      {timeUp ? (
        <span>
          {formatTimer(displayElapsed)}
          <span
            className={cn(
              "ml-2 font-sans font-normal",
              muted,
              compact ? "text-xs" : "text-sm",
            )}
          >
            0:00 left · Session ended
          </span>
        </span>
      ) : (
        <span>
          {formatTimer(displayElapsed)}
          <span
            className={cn(
              "ml-2 font-sans font-normal",
              muted,
              compact ? "text-xs" : "text-sm",
            )}
          >
            {formatTimer(remaining)} left
          </span>
        </span>
      )}
    </div>
  );
}
