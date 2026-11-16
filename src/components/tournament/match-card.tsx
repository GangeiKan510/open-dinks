"use client";

import { Volume2 } from "lucide-react";
import { useState } from "react";
import {
  isThirdPlaceMatch,
  matchWinnerId,
  pointsToWin,
  teamName,
  TournamentError,
  type GameScore,
  type TournamentMatch,
  type TournamentState,
  type TournamentTeam,
} from "@/engine/tournament";
import { Button } from "@/components/ui/button";
import {
  formatCourtCallAnnouncement,
  formatWarmupAnnouncement,
  speakAnnouncement,
} from "@/lib/speech-announcer";
import { cn } from "@/lib/utils";

export function MatchCard({
  state,
  match,
  groupName,
  onReport,
  onClear,
  onRenameTeam,
  swapSelectedId = null,
  onSwapSelect,
  onUnpark,
  upNext = false,
}: {
  state: TournamentState;
  match: TournamentMatch;
  groupName?: string | null;
  onReport: (matchId: string, games: GameScore[]) => void;
  onClear: (matchId: string) => void;
  onRenameTeam?: (teamId: string, playerA: string, playerB?: string) => boolean;
  swapSelectedId?: string | null;
  onSwapSelect?: (matchId: string) => void;
  onUnpark?: (matchId: string) => void;
  /** True when this match is among the next ones to fill a free court. */
  upNext?: boolean;
}) {
  const label = groupName
    ? `M${match.number} – ${groupName}`
    : `M${match.number}`;
  const winnerId = matchWinnerId(match);
  const canSwap =
    match.status === "unreported" &&
    Boolean(match.teamAId) &&
    Boolean(match.teamBId) &&
    onSwapSelect != null;
  const selected = swapSelectedId === match.id;
  const picking = swapSelectedId != null && !selected;

  if (match.status === "bye") {
    const advancerId = match.teamAId ?? match.teamBId;
    return (
      <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
          {label} · Bye
        </p>
        <div className="mt-1">
          <TeamName state={state} teamId={advancerId} onRename={onRenameTeam} />
        </div>
        <p className="text-sm text-[var(--muted)]">Advances</p>
      </article>
    );
  }

  const waiting = !match.teamAId || !match.teamBId;
  const onCourt = match.courtNumber != null;

  return (
    <article
      className={cn(
        "rounded-xl border bg-[var(--surface)] p-4",
        selected
          ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/40"
          : onCourt
            ? "border-[var(--accent)] ring-1 ring-[var(--accent)]/40"
            : "border-[var(--border)]",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{label}</h3>
        <CourtBadge state={state} match={match} upNext={upNext} />
      </div>
      {waiting ? (
        <div className="space-y-2 text-sm">
          <TeamName
            state={state}
            teamId={match.teamAId}
            pending={!match.teamAId}
            onRename={onRenameTeam}
          />
          <TeamName
            state={state}
            teamId={match.teamBId}
            pending={!match.teamBId}
            onRename={onRenameTeam}
          />
          <p className="text-[var(--muted)]">
            {isThirdPlaceMatch(match)
              ? "Waiting for the semifinals."
              : "Waiting for the other match."}
          </p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-[var(--muted)]">
            Play to {pointsToWin(state, match)}
            {match.live
              ? ` · live ${match.live.scoreA}–${match.live.scoreB}`
              : ""}
          </p>
          <ScoreForm
            key={`${match.id}:${match.teamAId}:${match.teamBId}:${match.status}:${state.gamesPerMatch}:${match.games.map((game) => `${game.a}-${game.b}`).join(",")}`}
            state={state}
            match={match}
            gamesPerMatch={state.gamesPerMatch}
            winnerId={winnerId}
            onReport={onReport}
            onClear={onClear}
            onRenameTeam={onRenameTeam}
          />
        </>
      )}
      {canSwap || (match.parked && onUnpark) ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {canSwap ? (
            <Button
              type="button"
              size="sm"
              variant={picking ? "default" : "outline"}
              aria-pressed={selected}
              onClick={() => onSwapSelect(match.id)}
            >
              {selected ? "Cancel swap" : picking ? "Swap with this" : "Swap"}
            </Button>
          ) : null}
          {match.parked && onUnpark ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onUnpark(match.id)}
            >
              Return to queue
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function matchPlayerNames(
  state: TournamentState,
  match: TournamentMatch,
): string[] {
  const names: string[] = [];
  for (const teamId of [match.teamAId, match.teamBId]) {
    const team = teamId
      ? state.teams.find((item) => item.id === teamId)
      : undefined;
    if (!team) continue;
    for (const player of team.players) {
      const trimmed = player.trim();
      if (trimmed) names.push(trimmed);
    }
  }
  return names;
}

function AnnounceButton({ label, text }: { label: string; text: string }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="h-7 w-7 shrink-0 px-0"
      aria-label={label}
      onClick={() => speakAnnouncement(text)}
    >
      <Volume2 className="h-4 w-4" aria-hidden />
    </Button>
  );
}

function CourtBadge({
  state,
  match,
  upNext,
}: {
  state: TournamentState;
  match: TournamentMatch;
  upNext: boolean;
}) {
  const names = matchPlayerNames(state, match);
  if (match.courtNumber != null) {
    const courtNumber = match.courtNumber;
    return (
      <div className="flex items-center gap-1">
        <AnnounceButton
          label={`Announce players to proceed to court ${courtNumber}`}
          text={formatCourtCallAnnouncement(names, courtNumber)}
        />
        <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-medium text-[var(--accent-fg)]">
          Court {courtNumber}
        </span>
      </div>
    );
  }
  if (match.status === "reported") {
    return (
      <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
        Reported
      </span>
    );
  }
  if (match.parked) {
    return (
      <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
        Parked
      </span>
    );
  }
  if (!match.teamAId || !match.teamBId) {
    return (
      <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
        Waiting
      </span>
    );
  }
  if (upNext) {
    return (
      <div className="flex items-center gap-1">
        <AnnounceButton
          label="Announce players to start warming up"
          text={formatWarmupAnnouncement(names)}
        />
        <span className="rounded-full bg-[var(--highlight)]/20 px-2 py-0.5 text-xs font-medium uppercase tracking-[0.14em] text-[var(--highlight)]">
          Up next
        </span>
      </div>
    );
  }
  return (
    <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
      In queue
    </span>
  );
}

function TeamName({
  state,
  teamId,
  won = false,
  pending = false,
  onRename,
}: {
  state: TournamentState;
  teamId: string | null;
  won?: boolean;
  pending?: boolean;
  onRename?: (teamId: string, playerA: string, playerB?: string) => boolean;
}) {
  const team = teamId
    ? state.teams.find((item) => item.id === teamId)
    : undefined;
  const name = teamName(state, teamId);
  const canEdit = Boolean(onRename && team);

  if (!canEdit || !team) {
    return (
      <p
        className={cn(
          "truncate text-sm",
          won && "font-semibold text-[var(--accent)]",
          pending && "text-[var(--muted)]",
        )}
      >
        {name}
      </p>
    );
  }

  return (
    <EditableTeamName
      team={team}
      format={state.format}
      won={won}
      onRename={onRename!}
    />
  );
}

function EditableTeamName({
  team,
  format,
  won,
  onRename,
}: {
  team: TournamentTeam;
  format: TournamentState["format"];
  won: boolean;
  onRename: (teamId: string, playerA: string, playerB?: string) => boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [playerA, setPlayerA] = useState(team.players[0] ?? "");
  const [playerB, setPlayerB] = useState(team.players[1] ?? "");

  function startEdit() {
    setPlayerA(team.players[0] ?? "");
    setPlayerB(team.players[1] ?? "");
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
  }

  function save() {
    const ok =
      format === "singles"
        ? onRename(team.id, playerA)
        : onRename(team.id, playerA, playerB);
    if (ok) setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEdit}
        title="Edit name"
        className={cn(
          "block max-w-full truncate text-left text-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
          won && "font-semibold text-[var(--accent)]",
        )}
      >
        {team.name}
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        <input
          aria-label="Player 1"
          value={playerA}
          autoFocus
          onChange={(event) => setPlayerA(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              save();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
          }}
          className="h-8 min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        />
        {format === "doubles" ? (
          <>
            <span className="text-sm text-[var(--muted)]">/</span>
            <input
              aria-label="Player 2"
              value={playerB}
              onChange={(event) => setPlayerB(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  save();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancel();
                }
              }}
              className="h-8 min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            />
          </>
        ) : null}
        <Button type="button" size="sm" onClick={save}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={cancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ScoreForm({
  state,
  match,
  gamesPerMatch,
  winnerId,
  onReport,
  onClear,
  onRenameTeam,
}: {
  state: TournamentState;
  match: TournamentMatch;
  gamesPerMatch: number;
  winnerId: string | null;
  onReport: (matchId: string, games: GameScore[]) => void;
  onClear: (matchId: string) => void;
  onRenameTeam?: (teamId: string, playerA: string, playerB?: string) => boolean;
}) {
  const [scores, setScores] = useState(() =>
    seedScores(match.games, gamesPerMatch),
  );
  const [error, setError] = useState<string | null>(null);

  function update(index: number, side: "a" | "b", value: string) {
    setScores((current) =>
      current.map((game, gameIndex) =>
        gameIndex === index ? { ...game, [side]: value } : game,
      ),
    );
  }

  function save() {
    try {
      onReport(match.id, parseScoreInputs(scores));
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof TournamentError
          ? caught.message
          : "Could not save that score.",
      );
    }
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <ScoreRow
        state={state}
        teamId={match.teamAId}
        won={winnerId != null && winnerId === match.teamAId}
        values={scores.map((game) => game.a)}
        onChange={(index, value) => update(index, "a", value)}
        onRenameTeam={onRenameTeam}
      />
      <ScoreRow
        state={state}
        teamId={match.teamBId}
        won={winnerId != null && winnerId !== match.teamAId}
        values={scores.map((game) => game.b)}
        onChange={(index, value) => update(index, "b", value)}
        onRenameTeam={onRenameTeam}
      />
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm">
          Save score
        </Button>
        {match.status === "reported" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              try {
                onClear(match.id);
                setError(null);
              } catch (caught) {
                setError(
                  caught instanceof TournamentError
                    ? caught.message
                    : "Could not clear that score.",
                );
              }
            }}
          >
            Clear
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function ScoreRow({
  state,
  teamId,
  won,
  values,
  onChange,
  onRenameTeam,
}: {
  state: TournamentState;
  teamId: string | null;
  won: boolean;
  values: string[];
  onChange: (index: number, value: string) => void;
  onRenameTeam?: (teamId: string, playerA: string, playerB?: string) => boolean;
}) {
  const label = teamName(state, teamId);
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <TeamName
          state={state}
          teamId={teamId}
          won={won}
          onRename={onRenameTeam}
        />
      </div>
      {values.map((value, index) => (
        <input
          key={index}
          aria-label={
            values.length === 1
              ? `${label} score`
              : `${label} game ${index + 1}`
          }
          inputMode="numeric"
          value={value}
          onChange={(event) => onChange(index, event.target.value)}
          className="h-8 w-12 rounded-md border border-[var(--border)] bg-[var(--surface)] text-center text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        />
      ))}
    </div>
  );
}

function seedScores(
  games: GameScore[],
  gamesPerMatch: number,
): Array<{ a: string; b: string }> {
  const count = Math.min(3, Math.max(1, gamesPerMatch));
  const seeded = games.slice(0, count).map((game) => ({
    a: String(game.a),
    b: String(game.b),
  }));
  while (seeded.length < count) seeded.push({ a: "", b: "" });
  return seeded;
}

function parseScoreInputs(
  scores: Array<{ a: string; b: string }>,
): GameScore[] {
  const games: GameScore[] = [];
  for (const score of scores) {
    const aBlank = score.a.trim() === "";
    const bBlank = score.b.trim() === "";
    if (aBlank && bBlank) continue;
    if (aBlank || bBlank) {
      throw new TournamentError("Enter both scores for each game.");
    }
    const a = Number(score.a);
    const b = Number(score.b);
    if (!Number.isInteger(a) || !Number.isInteger(b)) {
      throw new TournamentError(
        "Game scores have to be whole numbers from 0 to 99.",
      );
    }
    games.push({ a, b });
  }
  if (games.length === 0) {
    throw new TournamentError("Enter at least one game.");
  }
  return games;
}
