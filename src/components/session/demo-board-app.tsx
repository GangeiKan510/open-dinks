"use client";

import { useEffect, useState } from "react";
import type { EngineState } from "@/engine";
import { Wallboard } from "@/components/session/wallboard";
import { createDemoSession, loadDemoState } from "@/lib/demo-store";

function readDemo(): EngineState {
  if (typeof window === "undefined") return createDemoSession();
  return loadDemoState() ?? createDemoSession();
}

export function DemoBoardApp() {
  const [state, setState] = useState<EngineState>(readDemo);

  useEffect(() => {
    const id = window.setInterval(() => {
      const next = loadDemoState();
      if (next) setState(next);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  return <Wallboard state={state} />;
}
