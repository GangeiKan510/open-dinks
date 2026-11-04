"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Radio } from "lucide-react";
import { createSessionAction } from "@/app/actions/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  OPEN_PLAY_MODES,
  parsePlayerNameList,
  type OpenPlayMode,
} from "@/lib/open-play";
import { cn } from "@/lib/utils";
import type { SessionMode } from "@/engine";

function Segment({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
        pressed
          ? "bg-[var(--accent)] text-[var(--accent-fg)]"
          : "text-[var(--foreground)] hover:bg-[var(--surface)]",
      )}
    >
      {children}
    </button>
  );
}

export function OpenPlaySetupForm({
  venueId,
  defaultTitle,
}: {
  venueId: string;
  defaultTitle: string;
}) {
  const [format, setFormat] = useState<"doubles" | "singles">("doubles");
  const [duration, setDuration] = useState<"none" | "limit">("none");
  const [minutes, setMinutes] = useState(15);
  const [scoreTracking, setScoreTracking] = useState<"winner" | "scores">(
    "winner",
  );
  const [gameLimit, setGameLimit] = useState<"none" | "limit">("none");
  const [playerGameLimit, setPlayerGameLimit] = useState(4);
  const [matching, setMatching] = useState<"auto" | "manual">("manual");
  const [mode, setMode] = useState<SessionMode>("rotating");
  const [playerNames, setPlayerNames] = useState("");
  const [rulesOpen, setRulesOpen] = useState(false);

  const parsedNames = parsePlayerNameList(playerNames);
  const selectedMode =
    OPEN_PLAY_MODES.find((option) => option.mode === mode) ??
    OPEN_PLAY_MODES[0];

  function chooseFormat(next: "doubles" | "singles") {
    setFormat(next);
    if (next === "singles" && mode === "couple_hunt") setMode("rotating");
  }

  return (
    <form action={createSessionAction} className="space-y-5">
      <input type="hidden" name="venueId" value={venueId} />
      <input type="hidden" name="format" value={format} />
      <input type="hidden" name="duration" value={duration} />
      <input type="hidden" name="maxGameMinutes" value={minutes} />
      <input type="hidden" name="scoreTracking" value={scoreTracking} />
      <input type="hidden" name="gameLimit" value={gameLimit} />
      <input type="hidden" name="playerGameLimit" value={playerGameLimit} />
      <input type="hidden" name="matching" value={matching} />
      <input type="hidden" name="mode" value={mode} />

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-end">
        <div className="space-y-1">
          <Label htmlFor="title">Session name</Label>
          <Input id="title" name="title" defaultValue={defaultTitle} required />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Game type</p>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-[var(--surface-2)] p-1">
            <Segment
              pressed={format === "doubles"}
              onClick={() => chooseFormat("doubles")}
            >
              Doubles
            </Segment>
            <Segment
              pressed={format === "singles"}
              onClick={() => chooseFormat("singles")}
            >
              Singles
            </Segment>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">How the next group is picked</p>
        <div className="grid grid-cols-2 gap-2">
          {OPEN_PLAY_MODES.map((option) => (
            <ModeOption
              key={option.mode}
              option={option}
              selected={mode === option.mode}
              disabled={format === "singles" && option.mode === "couple_hunt"}
              onSelect={() => setMode(option.mode)}
            />
          ))}
        </div>
        {selectedMode ? (
          <p className="text-sm text-[var(--muted)]">
            {selectedMode.description}
          </p>
        ) : null}
        {mode === "skill_separated" ? (
          <p className="text-xs text-[var(--muted)]">
            Courts use the skill ranges from Settings. A court with no range
            accepts every player.
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-[var(--border)]">
        <button
          type="button"
          aria-expanded={rulesOpen}
          aria-controls="open-play-match-rules"
          onClick={() => setRulesOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <span className="min-w-0">
            <span className="block text-sm font-medium">Match rules</span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              {rulesSummary({
                duration,
                minutes,
                scoreTracking,
                gameLimit,
                playerGameLimit,
                matching,
              })}
            </span>
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              "h-4 w-4 shrink-0 text-[var(--muted)] transition-transform",
              rulesOpen && "rotate-180",
            )}
          />
        </button>
        {rulesOpen ? (
          <div
            id="open-play-match-rules"
            className="space-y-4 border-t border-[var(--border)] px-3 py-3"
          >
            <RuleRow
              title="Match duration"
              detail={
                duration === "none"
                  ? "Games run until you end them."
                  : "Call the court when the timer ends."
              }
              nonePressed={duration === "none"}
              limitPressed={duration === "limit"}
              onNone={() => setDuration("none")}
              onLimit={() => setDuration("limit")}
              limit={
                duration === "limit" ? (
                  <LimitField
                    id="max-game-minutes"
                    label="Minutes"
                    min={1}
                    max={60}
                    value={minutes}
                    onChange={setMinutes}
                  />
                ) : null
              }
            />

            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Score tracking</p>
                  <p className="text-xs text-[var(--muted)]">
                    {scoreTracking === "winner"
                      ? "Record who won, not the score."
                      : "Record both scores. The higher one wins."}
                  </p>
                </div>
                <div className="grid w-full grid-cols-2 gap-1 rounded-lg bg-[var(--surface-2)] p-1 sm:w-56">
                  <Segment
                    pressed={scoreTracking === "winner"}
                    onClick={() => setScoreTracking("winner")}
                  >
                    Winner only
                  </Segment>
                  <Segment
                    pressed={scoreTracking === "scores"}
                    onClick={() => setScoreTracking("scores")}
                  >
                    Track scores
                  </Segment>
                </div>
              </div>
            </div>

            <RuleRow
              title="Player game limit"
              detail={
                gameLimit === "none"
                  ? "Players can keep joining games."
                  : "They leave the queue after this many."
              }
              nonePressed={gameLimit === "none"}
              limitPressed={gameLimit === "limit"}
              onNone={() => setGameLimit("none")}
              onLimit={() => setGameLimit("limit")}
              limit={
                gameLimit === "limit" ? (
                  <LimitField
                    id="player-game-limit"
                    label="Games"
                    min={1}
                    max={30}
                    value={playerGameLimit}
                    onChange={setPlayerGameLimit}
                  />
                ) : null
              }
            />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">Matching</p>
                <p className="text-xs text-[var(--muted)]">
                  {matching === "auto"
                    ? "Fill courts as people check in."
                    : "You place each match yourself."}
                </p>
              </div>
              <div className="grid w-full grid-cols-2 gap-1 rounded-lg bg-[var(--surface-2)] p-1 sm:w-56">
                <Segment
                  pressed={matching === "auto"}
                  onClick={() => setMatching("auto")}
                >
                  Auto
                </Segment>
                <Segment
                  pressed={matching === "manual"}
                  onClick={() => setMatching("manual")}
                >
                  Manual
                </Segment>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor="player-names">Players</Label>
          <span className="text-xs text-[var(--muted)]">
            {parsedNames.names.length} added
          </span>
        </div>
        <textarea
          id="player-names"
          name="playerNames"
          value={playerNames}
          onChange={(event) => setPlayerNames(event.target.value)}
          rows={3}
          placeholder="Optional. One name per line."
          className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
        />
        <p className="text-xs text-[var(--muted)]">
          Leave this empty to check people in at the door. Added players start
          at Intermediate.
          {parsedNames.duplicates.length > 0
            ? ` Duplicate${parsedNames.duplicates.length === 1 ? "" : "s"} skipped: ${parsedNames.duplicates.join(", ")}.`
            : ""}
        </p>
      </div>

      <Button type="submit" size="lg">
        <Radio className="h-4 w-4 shrink-0" aria-hidden />
        Go live
      </Button>
    </form>
  );
}

function rulesSummary({
  duration,
  minutes,
  scoreTracking,
  gameLimit,
  playerGameLimit,
  matching,
}: {
  duration: "none" | "limit";
  minutes: number;
  scoreTracking: "winner" | "scores";
  gameLimit: "none" | "limit";
  playerGameLimit: number;
  matching: "auto" | "manual";
}): string {
  return [
    duration === "none" ? "No time limit" : `${minutes} min`,
    scoreTracking === "winner" ? "Winner only" : "Scores",
    gameLimit === "none" ? "No game cap" : `${playerGameLimit} games each`,
    matching === "auto" ? "Auto" : "Manual",
  ].join(" · ");
}

function RuleRow({
  title,
  detail,
  nonePressed,
  limitPressed,
  onNone,
  onLimit,
  limit,
}: {
  title: string;
  detail: string;
  nonePressed: boolean;
  limitPressed: boolean;
  onNone: () => void;
  onLimit: () => void;
  limit: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-[var(--muted)]">{detail}</p>
        </div>
        <div className="grid w-full shrink-0 grid-cols-2 gap-1 rounded-lg bg-[var(--surface-2)] p-1 sm:w-56">
          <Segment pressed={nonePressed} onClick={onNone}>
            No limit
          </Segment>
          <Segment pressed={limitPressed} onClick={onLimit}>
            Set limit
          </Segment>
        </div>
      </div>
      {limit}
    </div>
  );
}

function LimitField({
  id,
  label,
  min,
  max,
  value,
  onChange,
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (!Number.isFinite(next)) return;
          onChange(Math.min(max, Math.max(min, Math.round(next))));
        }}
        className="w-24"
      />
    </div>
  );
}

function ModeOption({
  option,
  selected,
  disabled,
  onSelect,
}: {
  option: OpenPlayMode;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "rounded-lg border px-3 py-2 text-left text-sm font-medium leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50",
        selected
          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]"
          : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]",
      )}
    >
      {option.label}
      {disabled ? <span className="sr-only">, doubles only</span> : null}
    </button>
  );
}
