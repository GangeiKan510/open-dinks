"use client";

import { useSyncExternalStore } from "react";
import { Wallboard } from "@/components/session/wallboard";
import {
  getClientTrue,
  getDemoServerSnapshot,
  getDemoSnapshot,
  getServerFalse,
  subscribeDemoState,
  subscribeNever,
} from "@/lib/demo-store";

export function DemoBoardApp() {
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

  return <Wallboard state={state} />;
}
