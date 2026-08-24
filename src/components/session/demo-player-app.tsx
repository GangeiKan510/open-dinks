"use client";

import { useEffect, useState } from "react";
import type { EngineAction, EngineState } from "@/engine";
import { PlayerView } from "@/components/session/player-view";
import {
  createDemoSession,
  dispatchDemo,
  loadDemoState,
} from "@/lib/demo-store";

function readDemo(): EngineState {
  if (typeof window === "undefined") return createDemoSession();
  return loadDemoState() ?? createDemoSession();
}

export function DemoPlayerApp() {
  const [state, setState] = useState<EngineState>(readDemo);

  useEffect(() => {
    const id = window.setInterval(() => {
      const next = loadDemoState();
      if (next) setState(next);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  function dispatch(action: EngineAction) {
    setState((prev) => dispatchDemo(prev, action));
  }

  return <PlayerView state={state} dispatch={dispatch} />;
}
