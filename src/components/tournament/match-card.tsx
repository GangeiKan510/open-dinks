"use client";

import { useState } from "react";
import {
  matchWinnerId,
  teamName,
  TournamentError,
  type GameScore,
  type TournamentMatch,
  type TournamentState,
} from "@/engine/tournament";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MatchCard({
  state,
  match,
  groupName,
  onReport,
  onClear,
}: {
  state: TournamentState;
  match: TournamentMatch;
  groupName?: string | null;
  onReport: (matchId: string, games: GameScore[]) => void;
  onClear: (matchId: string) => void;
}) {
  const label = groupName
    ? `M${match.number} – ${groupName}`
    : `M${match.number}`;
  const winnerId = matchWinnerId(match);

  if (match.status === "bye") {
    const advancer = teamName(state, match.teamAId ?? match.teamBId);
    return (
      <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
          {label} · Bye
        </p>
        <p className="mt-1 font-medium">{advancer}</p>
        <p className="text-sm text-[var(--muted)]">Advances</p>
      </article>
    );
  }

  const waiting = !match.teamAId || !match.teamBId;

  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{label}</h3>
        <CourtBadge match={match} />
      </div>
      {waiting ? (
        <div className="space-y-2 text-sm">
          <TeamLine
            name={teamName(state, match.teamAId)}
            won={false}
            pending={!match.teamAId}
          />
          <TeamLine
            name={teamName(state, match.teamBId)}
            won={false}
            pending={!match.teamBId}
          />
          <p className="text-[var(--muted)]">Waiting for the other match.</p>
        </div>
      ) : (
        <>
          {match.live ? (
            <p className="mb-3 text-sm tabular-nums text-[var(--accent)]">
              Live {match.live.scoreA}–{match.live.scoreB}
            </p>
          ) : null}
          <ScoreForm
            key={`${match.id}:${match.teamAId}:${match.teamBId}:${match.status}:${state.gamesPerMatch}:${match.games.map((game) => `${game.a}-${game.b}`).join(",")}`}
            match={match}
            gamesPerMatch={state.gamesPerMatch}
            nameA={teamName(state, match.teamAId)}
            nameB={teamName(state, match.teamBId)}
            winnerId={winnerId}
            teamAId={match.teamAId}
            onReport={onReport}
            onClear={onClear}
          />
        </>
      )}
    </article>
  );
}

function CourtBadge({ match }: { match: TournamentMatch }) {
  if (match.courtNumber != null) {
    return (
      <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-medium text-[var(--accent-fg)]">
        Court {match.courtNumber}
      </span>
    );
  }
  if (match.status === "reported") {
    return (
      <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
        Reported
      </span>
    );
  }
  return (
    <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
      Up next
    </span>
  );
}

function TeamLine({
  name,
  won,
  pending,
}: {
  name: string;
  won: boolean;
  pending?: boolean;
}) {
  return (
    <p
      className={cn(
        "truncate text-sm",
        won && "font-semibold",
        pending && "text-[var(--muted)]",
      )}
    >
      {name}
    </p>
  );
}

function ScoreForm({
  match,
  gamesPerMatch,
  nameA,
  nameB,
  winnerId,
  teamAId,
  onReport,
  onClear,
}: {
  match: TournamentMatch;
  gamesPerMatch: number;
  nameA: string;
  nameB: string;
  winnerId: string | null;
  teamAId: string | null;
  onReport: (matchId: string, games: GameScore[]) => void;
  onClear: (matchId: string) => void;
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
        name={nameA}
        won={winnerId != null && winnerId === teamAId}
        values={scores.map((game) => game.a)}
        onChange={(index, value) => update(index, "a", value)}
      />
      <ScoreRow
        name={nameB}
        won={winnerId != null && winnerId !== teamAId}
        values={scores.map((game) => game.b)}
        onChange={(index, value) => update(index, "b", value)}
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
  name,
  won,
  values,
  onChange,
}: {
  name: string;
  won: boolean;
  values: string[];
  onChange: (index: number, value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm",
          won && "font-semibold text-[var(--accent)]",
        )}
      >
        {name}
      </span>
      {values.map((value, index) => (
        <input
          key={index}
          aria-label={
            values.length === 1 ? `${name} score` : `${name} game ${index + 1}`
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
