"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  bracketChampion,
  bracketColumns,
  clubStandings,
  displayDivision,
  formatDiff,
  groupStandings,
  isSponsorLogoUrl,
  wildcardTeamIds,
  pointsToWin,
  SPONSOR_TIER_LABELS,
  SPONSOR_TIERS,
  type SponsorTier,
  stageProgress,
  teamName,
  type TournamentEvent,
  type TournamentMatch,
  type TournamentSponsor,
  type TournamentState,
} from "@/engine/tournament";
import { PRODUCT_NAME } from "@/lib/facility";
import { createClient } from "@/lib/supabase/client";
import { tournamentEventFromDocument } from "@/lib/tournament-document";
import { cn } from "@/lib/utils";

export function TournamentBoard({
  tournamentId,
  initialEvent,
}: {
  tournamentId: string;
  initialEvent: TournamentEvent;
}) {
  const [event, setEvent] = useState(initialEvent);
  const [pickedId, setPickedId] = useState<string | null>(null);

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
  const clubs = clubStandings(event);
  const playing = event.categories.filter(
    (category) => category.phase !== "setup",
  );
  const selected =
    playing.find((category) => category.id === pickedId) ?? playing[0] ?? null;
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
      <div
        className={
          event.sponsors.length > 0
            ? "mx-auto flex min-h-screen max-w-[1600px] flex-col gap-8 px-6 pb-28 pt-6 md:px-10 md:pt-10"
            : "mx-auto flex min-h-screen max-w-[1600px] flex-col gap-8 p-6 md:p-10"
        }
      >
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <span
              className="brand-mark brand-mark-on-board"
              role="img"
              aria-label={PRODUCT_NAME}
            />
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl md:text-6xl">
              {event.name.trim() || "Club tournament"}
            </h1>
            <p className="mt-2 text-sm tracking-wide text-[var(--highlight)]">
              {event.categories
                .map((category) => displayDivision(category))
                .join(" · ")}
            </p>
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
            <Link
              href="/tournament"
              className="text-[var(--highlight)] underline"
            >
              Director
            </Link>
          </div>
        </header>

        {clubs.length > 0 ? <ClubWins rows={clubs} /> : null}

        {playing.length === 0 ? (
          <p className="text-2xl text-white/70">
            Build the draw on the tournament desk, then leave this page on the
            gym TV.
          </p>
        ) : (
          <>
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
            {selected ? (
              <Tabs value={selected.id} onValueChange={setPickedId}>
                <TabsList
                  aria-label="Categories"
                  className="!border-white/10 !bg-white/5"
                >
                  {playing.map((category) => (
                    <TabsTrigger
                      key={category.id}
                      value={category.id}
                      className="text-white/70 hover:!text-white data-[state=active]:!bg-[var(--highlight)] data-[state=active]:!text-[var(--ink)] data-[state=active]:!shadow-none"
                    >
                      {displayDivision(category)}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {playing.map((category) => {
                  const champion = bracketChampion(category);
                  return (
                    <TabsContent
                      key={category.id}
                      value={category.id}
                      className="space-y-4"
                    >
                      {champion ? (
                        <p className="font-[family-name:var(--font-display)] text-3xl text-[var(--highlight)] md:text-5xl">
                          {champion.name} won {displayDivision(category)}
                        </p>
                      ) : null}
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
                    </TabsContent>
                  );
                })}
              </Tabs>
            ) : null}
          </>
        )}
      </div>
      {event.sponsors.length > 0 ? (
        <SponsorTicker sponsors={event.sponsors} />
      ) : null}
    </div>
  );
}

const TIER_SECTION: Record<SponsorTier, string> = {
  platinum: "bg-white text-[#102018]",
  gold: "bg-[#e6b325] text-[#2a1d00]",
  silver: "bg-[#8d99a3] text-white",
  bronze: "bg-[#c47b3a] text-[#1c1208]",
  nickel: "bg-[#3d474e] text-[#f4f7f8]",
};

function SponsorTicker({ sponsors }: { sponsors: TournamentSponsor[] }) {
  const logos = sponsors.filter((sponsor) => isSponsorLogoUrl(sponsor.url));
  const groups = SPONSOR_TIERS.map((tier) => ({
    tier,
    logos: logos.filter((sponsor) => sponsor.tier === tier),
  })).filter((group) => group.logos.length > 0);
  if (groups.length === 0) return null;
  const seconds = Math.max(24, logos.length * 8);
  return (
    <section
      aria-label="Sponsors"
      className="fixed inset-x-0 bottom-0 z-30 overflow-hidden border-t border-white/10 bg-[var(--ink)]"
    >
      <div
        className="sponsor-ticker-track flex w-max items-stretch"
        style={{ ["--ticker-duration" as string]: `${seconds}s` }}
      >
        <TickerSequence groups={groups} />
        <TickerSequence groups={groups} copy />
      </div>
    </section>
  );
}

function TickerSequence({
  groups,
  copy = false,
}: {
  groups: Array<{ tier: SponsorTier; logos: TournamentSponsor[] }>;
  copy?: boolean;
}) {
  return (
    <div
      className={copy ? "sponsor-ticker-copy flex" : "flex"}
      aria-hidden={copy || undefined}
    >
      {groups.map((group) => (
        <div
          key={group.tier}
          className={`flex shrink-0 items-stretch ${TIER_SECTION[group.tier]}`}
        >
          <p className="flex items-center border-r border-black/15 px-4 text-xs font-semibold uppercase tracking-[0.16em]">
            {SPONSOR_TIER_LABELS[group.tier]} sponsors
          </p>
          {group.logos.map((sponsor) => (
            <SponsorLogo key={sponsor.id} sponsor={sponsor} />
          ))}
        </div>
      ))}
    </div>
  );
}

function SponsorLogo({ sponsor }: { sponsor: TournamentSponsor }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  const name = sponsor.name.trim() || "Sponsor";
  return (
    <span className="flex items-center border-r border-black/10 px-4">
      {/* Sponsor files are already small uploads on the tournament's storage host. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sponsor.url}
        alt={name}
        className="h-12 w-auto max-w-[9rem] object-contain"
        onError={() => setHidden(true)}
      />
    </span>
  );
}

function ClubWins({
  rows,
}: {
  rows: Array<{ club: string; wins: number; losses: number }>;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10">
      <h2 className="border-b border-white/10 px-4 py-3 font-[family-name:var(--font-display)] text-3xl">
        Club wins
      </h2>
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.14em] text-white/40">
          <tr>
            <th className="px-4 py-2 font-medium" scope="col">
              Club
            </th>
            {["W", "L"].map((label) => (
              <th
                key={label}
                className="px-4 py-2 text-right font-medium"
                scope="col"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.club} className="border-t border-white/10">
              <td className="px-4 py-3 text-lg">{row.club}</td>
              <td className="px-4 py-3 text-right text-lg tabular-nums text-[var(--highlight)]">
                {row.wins}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-white/70">
                {row.losses}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
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
        <span className="text-[var(--highlight)]">
          Court {match.courtNumber}
        </span>
        <span className="text-white/50">
          {displayDivision(state)}
          {group ? ` · ${group.name}` : ` · M${match.number}`}
        </span>
      </div>
      <p className="text-sm text-white/50">
        Play to {pointsToWin(state, match)}
      </p>
      <ScoreLine
        name={teamName(state, match.teamAId)}
        score={match.live?.serving ? match.live.scoreA : null}
      />
      <ScoreLine
        name={teamName(state, match.teamBId)}
        score={match.live?.serving ? match.live.scoreB : null}
        muted
      />
    </article>
  );
}

function ScoreLine({
  name,
  score,
  muted = false,
}: {
  name: string;
  score: number | null;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span
        className={
          muted
            ? "min-w-0 truncate text-lg text-white/80"
            : "min-w-0 truncate text-lg"
        }
      >
        {name}
      </span>
      {score != null ? (
        <span className="shrink-0 font-[family-name:var(--font-display)] text-4xl leading-none tabular-nums text-[var(--highlight)]">
          {score}
        </span>
      ) : null}
    </div>
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
  const wildcards = new Set(wildcardTeamIds(state));
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
            <tr
              key={row.teamId}
              className={cn(
                "border-t border-white/10",
                wildcards.has(row.teamId) && "bg-white/10",
              )}
            >
              <td className="px-3 py-2">
                {row.rank}. {row.name}
                {wildcards.has(row.teamId) ? (
                  <span className="ml-2 text-xs uppercase tracking-[0.12em] text-white/50">
                    Wild card
                  </span>
                ) : null}
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
  const columns = bracketColumns(state);

  return (
    <section className="space-y-3">
      <h2 className="text-sm uppercase tracking-[0.2em] text-white/50">
        Finals
      </h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {columns.map((column) => (
          <div key={column.key} className="w-64 shrink-0 space-y-4">
            {column.groups.map((group) => (
              <div key={group.label} className="space-y-2">
                <h3 className="text-sm text-white/60">{group.label}</h3>
                {group.matches.map((match) => (
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
            ))}
          </div>
        ))}
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
