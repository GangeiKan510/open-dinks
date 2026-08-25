"use client";

import { useState, useSyncExternalStore } from "react";
import type { EngineAction } from "@/engine";
import { summarizeSession } from "@/engine";
import { HostConsole } from "@/components/session/host-console";
import {
  createDemoSession,
  dispatchDemo,
  getClientTrue,
  getDemoServerSnapshot,
  getDemoSnapshot,
  getServerFalse,
  seedDemoPlayers,
  subscribeDemoState,
  subscribeNever,
} from "@/lib/demo-store";
import { formatSkillTier } from "@/lib/skill-tier";
import { Button } from "@/components/ui/button";

export function DemoHostApp() {
  const hydrated = useSyncExternalStore(
    subscribeNever,
    getClientTrue,
    getServerFalse,
  );
  const liveState = useSyncExternalStore(
    subscribeDemoState,
    getDemoSnapshot,
    getDemoServerSnapshot,
  );
  const state = hydrated ? liveState : getDemoServerSnapshot();
  const [ended, setEnded] = useState(false);

  function dispatch(action: EngineAction) {
    dispatchDemo(state, action);
  }

  if (ended) {
    const summary = summarizeSession(state);
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
        <h1 className="font-[family-name:var(--font-display)] text-4xl">
          Session complete
        </h1>
        <p className="text-[var(--muted)]">
          Fairness snapshot from this open play.
        </p>
        <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {summary.map((row, i) => (
            <li
              key={row.playerId}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <span>
                {i + 1}. {row.name}
              </span>
              <span className="tabular-nums text-[var(--muted)]">
                {row.wins} wins · {row.gamesPlayed} games ·{" "}
                {formatSkillTier(row.skill)}
              </span>
            </li>
          ))}
        </ul>
        <Button
          onClick={() => {
            createDemoSession();
            setEnded(false);
          }}
        >
          Start new demo
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 py-6 md:px-8">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => seedDemoPlayers(state)}
        >
          Seed 12 players
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            createDemoSession();
          }}
        >
          Reset demo
        </Button>
      </div>
      <HostConsole
        state={state}
        dispatch={dispatch}
        boardUrl="/demo/board"
        onEndSession={() => setEnded(true)}
      />
    </div>
  );
}
