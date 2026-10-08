"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  bracketChampion,
  displayDivision,
  formatDiff,
  groupStandings,
  roundLabel,
  stageProgress,
  teamName,
  type TournamentEvent,
  type TournamentMatch,
  type TournamentState,
} from "@/engine/tournament";
import { tournamentEventFromDocument } from "@/lib/tournament-document";
import { createClient } from "@/lib/supabase/client";

export function TournamentBoard({
  tournamentId,
  initialEvent,
}: {
  tournamentId: string;
  initialEvent: TournamentEvent;
}) {
  const [event, setEvent] = useState(initialEvent);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`tournament-board:${tournamentId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tournaments",
          filter: `id=eq.${tournamentId}`,
        },
        (payload) => {
          const next = tournamentEventFromDocument(payload.new.document);
          if (next) setEvent(next);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tournamentId]);
  const playing = event.categories.filter(
    (category) => category.phase !== "setup",
  );
  const onCourt = playing.flatMap((category) => {
    const stage = category.phase === "bracket" ? "bracket" : "groups";
    return category.matches
      .filter((match) => match.stage === stage && match.courtNumber != null)
      .map((match) => ({ category, match }));
  });
  const reported = playing.reduce(
    (sum, category) => {
      const stage = category.phase === "bracket" ? "bracket" : "groups";
      const progress = stageProgress(category, stage);
      return {
        reported: sum.reported + progress.reported,
        total: sum.total + progress.total,
      };
    },
    { reported: 0, total: 0 },
  );

  return (
    <div className="min-h-screen bg-[var(--ink)] text-[var(--paper)]">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-8 p-6 md:p-10">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="text-sm tracking-wide text-[var(--lime)]">
              {event.categories
                .map((category) => displayDivision(category))
                .join(" · ")}
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl">
              {event.name.trim() || "Club tournament"}
            </h1>
          </div>
          <div className="text-right text-sm text-white/60">
            <div>
              {playing.length === 0 ? "Draw not built" : "Categories live"}
            </div>
            {playing.length === 0 ? null : (
              <div className="tabular-nums">
                {reported.reported}/{reported.total} reported
              </div>
            )}
            <Link href="/tournament" className="text-[var(--lime)] underline">
              Director
            </Link>
          </div>
        </header>

        {playing.length === 0 ? (
          <p className="text-2xl text-white/70">
            Build the draw on the tournament desk, then leave this page on the
            gym TV.
          </p>
        ) : (
          <>
            {playing.map((category) => {
              const champion = bracketChampion(category);
              if (!champion) return null;
              return (
                <p
                  key={category.id}
                  className="font-[family-name:var(--font-display)] text-3xl text-[var(--lime)] md:text-5xl"
                >
                  {champion.name} won {displayDivision(category)}
                </p>
              );
            })}
            <section className="space-y-4">
              <h2 className="text-sm uppercase tracking-[0.2em] text-white/50">
                On court
              </h2>
              {onCourt.length === 0 ? (
                <p className="text-white/60">No matches on court.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {onCourt
                    .slice()
                    .sort(
                      (a, b) =>
                        (a.match.courtNumber ?? 0) - (b.match.courtNumber ?? 0),
                    )
                    .map(({ category, match }) => (
                      <CourtTile
                        key={`${category.id}:${match.id}`}
                        state={category}
                        match={match}
                      />
                    ))}
                </div>
              )}
            </section>
            {playing.map((category) => (
              <section key={category.id} className="space-y-4">
                <h2 className="font-[family-name:var(--font-display)] text-3xl">
                  {displayDivision(category)}
                </h2>
                {category.phase === "bracket" ? (
                  <BracketStrip state={category} />
                ) : null}
                <div className="grid gap-4 lg:grid-cols-2">
                  {category.groups.map((group) => (
                    <GroupCard
                      key={`${category.id}:${group.id}`}
                      state={category}
                      groupId={group.id}
                    />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function CourtTile({
  state,
  match,
}: {
  state: TournamentState;
  match: TournamentMatch;
}) {
  const group = state.groups.find((item) => item.id === match.groupId);
  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="text-[var(--lime)]">Court {match.courtNumber}</span>
        <span className="text-white/50">
          {displayDivision(state)}
          {group ? ` · ${group.name}` : ` · M${match.number}`}
        </span>
      </div>
      <p className="text-lg">{teamName(state, match.teamAId)}</p>
      <p className="text-lg text-white/80">{teamName(state, match.teamBId)}</p>
      {match.live?.serving ? (
        <p className="mt-3 font-[family-name:var(--font-display)] text-4xl tabular-nums text-[var(--lime)]">
          {match.live.scoreA}
          <span className="mx-2 text-white/30">–</span>
          {match.live.scoreB}
        </p>
      ) : null}
    </article>
  );
}

function GroupCard({
  state,
  groupId,
}: {
  state: TournamentState;
  groupId: string;
}) {
  const group = state.groups.find((item) => item.id === groupId);
  if (!group) return null;
  const rows = groupStandings(state, groupId);
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10">
      <h3 className="border-b border-white/10 px-4 py-3 font-[family-name:var(--font-display)] text-2xl">
        {group.name}
      </h3>
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.14em] text-white/40">
          <tr>
            <th className="px-3 py-2 font-medium" scope="col">
              Team
            </th>
            {["W", "L", "+/-"].map((label) => (
              <th
                key={label}
                className="px-3 py-2 text-right font-medium"
                scope="col"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.teamId} className="border-t border-white/10">
              <td className="px-3 py-2">
                {row.rank}. {row.name}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{row.wins}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {row.losses}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatDiff(row.diff)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function BracketStrip({ state }: { state: TournamentState }) {
  const matches = state.matches.filter((match) => match.stage === "bracket");
  const rounds = [...new Set(matches.map((match) => match.round))].sort(
    (a, b) => a - b,
  );
  const lastRound = rounds[rounds.length - 1] ?? 1;

  return (
    <section className="space-y-3">
      <h2 className="text-sm uppercase tracking-[0.2em] text-white/50">
        Finals
      </h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {rounds.map((round) => {
          const inRound = matches
            .filter((match) => match.round === round)
            .sort((a, b) => a.slot - b.slot);
          return (
            <div key={round} className="w-64 shrink-0 space-y-2">
              <h3 className="text-sm text-white/60">
                {roundLabel(inRound.length, round, lastRound)}
              </h3>
              {inRound.map((match) => (
                <article
                  key={match.id}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                >
                  {match.status === "bye" ? (
                    <p>
                      {teamName(state, match.teamAId ?? match.teamBId)} · bye
                    </p>
                  ) : (
                    <>
                      <BoardSide
                        name={teamName(state, match.teamAId)}
                        scores={match.games.map((game) => game.a)}
                      />
                      <BoardSide
                        name={teamName(state, match.teamBId)}
                        scores={match.games.map((game) => game.b)}
                      />
                    </>
                  )}
                </article>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BoardSide({ name, scores }: { name: string; scores: number[] }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="truncate">{name}</span>
      <span className="shrink-0 tabular-nums text-white/70">
        {scores.join("  ")}
      </span>
    </div>
  );
}
