import { clampMaxGameMinutes, type SessionMode } from "@/engine";

export type OpenPlayMode = {
  mode: SessionMode;
  label: string;
  description: string;
};

/** Matchmaking choices shown when a host starts open play. */
export const OPEN_PLAY_MODES: OpenPlayMode[] = [
  {
    mode: "rotating",
    label: "Balanced",
    description:
      "Skill-aware matchmaking for mixed groups. Builds balanced, competitive matchups with even sides.",
  },
  {
    mode: "all_random",
    label: "All Random",
    description: "Random matchups. Chaos in a good way.",
  },
  {
    mode: "rated",
    label: "Rated Match",
    description: "Groups similarly-skilled players within a rating window.",
  },
  {
    mode: "court_kings",
    label: "Court Kings",
    description: "Winners of the last match face winners; losers face losers.",
  },
  {
    mode: "skill_separated",
    label: "Skill Exclusive Courts",
    description:
      "Give each court its own skill range; players are only placed on courts that fit their level.",
  },
  {
    mode: "king_of_court",
    label: "Last Man Standing",
    description:
      "Winners hold the court and keep playing until they lose; challengers come up from the queue.",
  },
  {
    mode: "social_shuffle",
    label: "Social Shuffle",
    description:
      "Never the same partner twice: every game teams you with someone new for the whole session. Booked pairs stay together.",
  },
  {
    mode: "couple_hunt",
    label: "Couple Hunt",
    description:
      "Mixed doubles with a twist: every team is one man and one woman, and no couple repeats for the whole session. Doubles only; players pick a gender at check-in.",
  },
];

const MODE_LABELS: Record<SessionMode, string> = {
  rotating: "Balanced",
  all_random: "All Random",
  rated: "Rated Match",
  court_kings: "Court Kings",
  skill_separated: "Skill Exclusive Courts",
  king_of_court: "Last Man Standing",
  social_shuffle: "Social Shuffle",
  couple_hunt: "Couple Hunt",
  singles: "Singles",
};

export function openPlayModeLabel(mode: SessionMode): string {
  return MODE_LABELS[mode];
}

export function isOpenPlayMode(value: string): value is SessionMode {
  return OPEN_PLAY_MODES.some((mode) => mode.mode === value);
}

export type OpenPlaySetup = {
  title: string;
  format: "doubles" | "singles";
  mode: SessionMode;
  maxGameMinutes: number | null;
  scoreTracking: "winner" | "scores";
  playerGameLimit: number | null;
  matching: "auto" | "manual";
  playerNames: string[];
};

export function defaultOpenPlayTitle(
  timeZone: string,
  now = new Date(),
): string {
  let weekday = "Weeknight";
  try {
    weekday = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      timeZone: timeZone || "UTC",
    }).format(now);
  } catch {
    weekday = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      timeZone: "UTC",
    }).format(now);
  }
  return `${weekday} Open Play`;
}

/** Split a pasted list. The first spelling of a name wins; later copies are duplicates. */
export function parsePlayerNameList(raw: string): {
  names: string[];
  duplicates: string[];
} {
  const parts = raw
    .split(/[\n,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const names: string[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();

  for (const name of parts) {
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) {
      duplicates.push(name);
      continue;
    }
    seen.add(key);
    names.push(name);
  }

  return { names, duplicates };
}

function clampedGameLimit(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 4;
  return Math.min(30, Math.max(1, Math.round(parsed)));
}

export function parseOpenPlayForm(formData: FormData): OpenPlaySetup {
  const title = String(formData.get("title") ?? "").trim() || "Open Play";
  const format = formData.get("format") === "singles" ? "singles" : "doubles";
  const requested = String(formData.get("mode") ?? "rotating");
  let mode: SessionMode = isOpenPlayMode(requested) ? requested : "rotating";
  if (mode === "couple_hunt" && format === "singles") mode = "rotating";

  const maxGameMinutes =
    formData.get("duration") === "limit"
      ? clampMaxGameMinutes(Number(formData.get("maxGameMinutes")))
      : null;

  const scoreTracking =
    formData.get("scoreTracking") === "scores" ? "scores" : "winner";

  const playerGameLimit =
    formData.get("gameLimit") === "limit"
      ? clampedGameLimit(formData.get("playerGameLimit"))
      : null;

  const matching = formData.get("matching") === "auto" ? "auto" : "manual";
  const { names } = parsePlayerNameList(
    String(formData.get("playerNames") ?? ""),
  );

  return {
    title,
    format,
    mode,
    maxGameMinutes,
    scoreTracking,
    playerGameLimit,
    matching,
    playerNames: names,
  };
}
