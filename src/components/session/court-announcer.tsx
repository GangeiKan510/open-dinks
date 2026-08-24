"use client";

import { useEffect, useRef, useState } from "react";
import type { EngineState } from "@/engine";
import { matchRemainingMs } from "@/engine";
import {
  DEFAULT_WARNING_MINUTES,
  formatTimeUpAnnouncement,
  isTimeUp,
  isWithinWarningWindow,
  speakAnnouncement,
} from "@/lib/speech-announcer";

/**
 * Watches active court timers and speaks when warning time or max game time is reached.
 * Mount once on the wallboard (or host view) with `enabled` true after a user gesture.
 */
export function CourtAnnouncer({
  state,
  enabled,
  warningMinutes = DEFAULT_WARNING_MINUTES,
}: {
  state: EngineState;
  enabled: boolean;
  warningMinutes?: number;
}) {
  const announced = useRef(new Set<string>());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const active = state.matches.filter((m) => m.status === "active");
    const activeIds = new Set(active.map((m) => m.id));

    for (const match of active) {
      const remaining = matchRemainingMs(match, state.maxGameMinutes, now);
      const warnKey = `${match.id}:warn`;
      const timeUpKey = `${match.id}:timeup`;

      if (
        isWithinWarningWindow(
          remaining,
          state.maxGameMinutes,
          warningMinutes,
        ) &&
        !announced.current.has(warnKey)
      ) {
        announced.current.add(warnKey);
        speakAnnouncement(`${match.courtName}, two minutes remaining.`);
      }

      if (
        isTimeUp(match.status, remaining) &&
        !announced.current.has(timeUpKey)
      ) {
        announced.current.add(timeUpKey);
        speakAnnouncement(formatTimeUpAnnouncement(match.courtName));
      }
    }

    for (const key of announced.current) {
      const matchId = key.split(":")[0];
      if (!activeIds.has(matchId)) {
        announced.current.delete(key);
      }
    }
  }, [enabled, now, state.matches, state.maxGameMinutes, warningMinutes]);

  return null;
}
