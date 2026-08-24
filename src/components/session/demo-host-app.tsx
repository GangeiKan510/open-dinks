"use client";

import { useState } from "react";
import type { EngineAction, EngineState } from "@/engine";
import { summarizeSession } from "@/engine";
import { HostConsole } from "@/components/session/host-console";
import {
  createDemoSession,
  dispatchDemo,
  loadDemoState,
  seedDemoPlayers,
} from "@/lib/demo-store";
import { formatSkillTier } from "@/lib/skill-tier";
import { Button } from "@/components/ui/button";

function getInitialDemoState(): EngineState {
  if (typeof window === "undefined") {
    return createDemoSession();
  }
  return loadDemoState() ?? createDemoSession();
}

export function DemoHostApp() {
  const [state, setState] = useState<EngineState>(getInitialDemoState);
  const [ended, setEnded] = useState(false);

  function dispatch(action: EngineAction) {
    setState((prev) => dispatchDemo(prev, action));
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
            const next = createDemoSession();
            setState(next);
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
          onClick={() => setState((s) => seedDemoPlayers(s))}
        >
          Seed 12 players
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setState(createDemoSession());
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
