import {
  createInitialState,
  reduce,
  summarizeSession,
  type EngineAction,
  type EngineState,
  type SessionMode,
  type SessionSummary,
} from "@/engine";
import { SKILL_TIERS, type SkillTier } from "@/lib/skill-tier";
import { DEFAULT_COURT_COUNT, normalizeCourtCount } from "@/lib/court-count";

const STORAGE_KEY = "opendinks.demo.v1";
const DEMO_EVENT = "opendinks-demo";

const SERVER_DEMO_STATE = createInitialState({
  mode: "rotating",
  now: 0,
  courts: Array.from({ length: DEFAULT_COURT_COUNT }, (_, i) => ({
    id: `c${i + 1}`,
    name: `Court ${i + 1}`,
  })),
  players: [],
  matches: [],
});

let cachedRaw: string | null | undefined;
let cachedState: EngineState = SERVER_DEMO_STATE;

export function loadDemoState(): EngineState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EngineState;
  } catch {
    return null;
  }
}

export function saveDemoState(state: EngineState) {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(state);
  window.localStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedState = state;
  window.dispatchEvent(new Event(DEMO_EVENT));
}

export function subscribeDemoState(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(DEMO_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(DEMO_EVENT, onStoreChange);
  };
}

export function getDemoSnapshot(): EngineState {
  if (typeof window === "undefined") return SERVER_DEMO_STATE;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedState;
  cachedRaw = raw;
  if (!raw) {
    cachedState = SERVER_DEMO_STATE;
    return cachedState;
  }
  try {
    cachedState = JSON.parse(raw) as EngineState;
  } catch {
    cachedState = SERVER_DEMO_STATE;
  }
  return cachedState;
}

export function getDemoServerSnapshot(): EngineState {
  return SERVER_DEMO_STATE;
}

export function subscribeNever() {
  return () => {};
}

export function getClientTrue() {
  return true;
}

export function getServerFalse() {
  return false;
}

export function createDemoSession(options?: {
  courts?: number;
  mode?: SessionMode;
}): EngineState {
  const courtCount = normalizeCourtCount(options?.courts, DEFAULT_COURT_COUNT);
  const state = createInitialState({
    mode: options?.mode ?? "rotating",
    now: Date.now(),
    courts: Array.from({ length: courtCount }, (_, i) => ({
      id: `c${i + 1}`,
      name: `Court ${i + 1}`,
      skillMin:
        options?.mode === "skill_separated"
          ? i < 1
            ? ("beginner" as SkillTier)
            : ("intermediate" as SkillTier)
          : undefined,
      skillMax:
        options?.mode === "skill_separated"
          ? i < 1
            ? ("novice" as SkillTier)
            : ("advanced" as SkillTier)
          : undefined,
    })),
    players: [],
    matches: [],
  });
  saveDemoState(state);
  return state;
}

export function dispatchDemo(
  state: EngineState,
  action: EngineAction,
): EngineState {
  const next = reduce({ ...state, now: Date.now() }, action);
  saveDemoState(next);
  return next;
}

export function demoSummary(state: EngineState): SessionSummary[] {
  return summarizeSession(state);
}

export function seedDemoPlayers(state: EngineState): EngineState {
  const names = [
    "Alex",
    "Blake",
    "Casey",
    "Drew",
    "Eden",
    "Finley",
    "Gray",
    "Harper",
    "Indie",
    "Jordan",
    "Kai",
    "Logan",
  ];
  let next = state;
  names.forEach((name, i) => {
    next = dispatchDemo(next, {
      type: "CHECK_IN",
      player: {
        id: `demo_${name.toLowerCase()}`,
        name,
        skill: SKILL_TIERS[i % SKILL_TIERS.length],
      },
    });
  });
  return next;
}
