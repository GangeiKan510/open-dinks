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
    label: "Fair Mix",
    description:
      "Skill-aware pairing for mixed groups. Even sides, competitive games, fair wait times.",
  },
  {
    mode: "all_random",
    label: "Chaos Draw",
    description: "Pure random matchups. No skill math, just the next names.",
  },
  {
    mode: "rated",
    label: "Rating Band",
    description: "Keeps games inside a rating window so sides stay close.",
  },
  {
    mode: "court_kings",
    label: "Winner Path",
    description: "Winners of the last match face winners; losers face losers.",
  },
  {
    mode: "skill_separated",
    label: "Skill Lanes",
    description:
      "Each court gets its own skill range. Players only land on a lane that fits their level.",
  },
  {
    mode: "king_of_court",
    label: "Court Hold",
    description:
      "Winners keep the court until they lose. Challengers come up from the queue.",
  },
  {
    mode: "social_shuffle",
    label: "Fresh Partners",
    description:
      "Never the same partner twice for the whole session. Booked pairs stay together.",
  },
  {
    mode: "couple_hunt",
    label: "Mixed Only",
    description:
      "Every team is one man and one woman, and no pair repeats for the whole session. Doubles only; players pick a gender at check-in.",
  },
];

const MODE_LABELS: Record<SessionMode, string> = {
  rotating: "Fair Mix",
  all_random: "Chaos Draw",
  rated: "Rating Band",
  court_kings: "Winner Path",
  skill_separated: "Skill Lanes",
  king_of_court: "Court Hold",
  social_shuffle: "Fresh Partners",
  couple_hunt: "Mixed Only",
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
