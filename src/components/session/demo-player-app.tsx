"use client";

import { useSyncExternalStore } from "react";
import type { EngineAction } from "@/engine";
import { PlayerView } from "@/components/session/player-view";
import {
  dispatchDemo,
  getClientTrue,
  getDemoServerSnapshot,
  getDemoSnapshot,
  getServerFalse,
  subscribeDemoState,
  subscribeNever,
} from "@/lib/demo-store";

export function DemoPlayerApp() {
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

  function dispatch(action: EngineAction) {
    dispatchDemo(state, action);
  }

  return <PlayerView state={state} dispatch={dispatch} />;
}
