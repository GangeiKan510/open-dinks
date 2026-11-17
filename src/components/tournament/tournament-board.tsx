"use client";

import { QrCode } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SessionQr } from "@/components/session/session-qr";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  bracketChampion,
  bracketColumns,
  clubStandings,
  displayDivision,
  formatDiff,
  groupStandings,
  isSponsorLogoUrl,
  isThirdPlaceMatch,
  matchWinnerId,
  wildcardTeamIds,
  pointsToWin,
  SPONSOR_TIER_LABELS,
  SPONSOR_TIERS,
  type SponsorTier,
  stageProgress,
  teamName,
  upcomingMatches,
  type TournamentEvent,
  type TournamentMatch,
  type TournamentSponsor,
  type TournamentState,
} from "@/engine/tournament";
import { PRODUCT_NAME } from "@/lib/facility";
import { scoreboardQrDownloadName } from "@/lib/scoreboard-qr";
import { createClient } from "@/lib/supabase/client";
import { tournamentEventFromDocument } from "@/lib/tournament-document";
import { cn } from "@/lib/utils";

export function TournamentBoard({
  tournamentId,
  initialEvent,
  publicToken = "",
  canShareScoreboard = false,
}: {
  tournamentId: string;
  initialEvent: TournamentEvent;
  publicToken?: string;
  canShareScoreboard?: boolean;
}) {
  const [event, setEvent] = useState(initialEvent);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [showScoreboardQr, setShowScoreboardQr] = useState(false);
  const [scoreboardUrl, setScoreboardUrl] = useState<string | null>(null);

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
  const upNext = upcomingMatches(event);
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
                .map((category) =>
                  category.format === "singles"
                    ? `${displayDivision(category)} Singles`
                    : displayDivision(category),
                )
                .join(" · ")}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-right text-sm text-white/60">
            <div>
              {playing.length === 0 ? "Draw not built" : "Categories live"}
            </div>
            {playing.length === 0 ? null : (
              <div className="tabular-nums">
                {reported.reported}/{reported.total} reported
              </div>
            )}
            {canShareScoreboard ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-white/20 text-[var(--paper)] hover:bg-white/10"
                aria-expanded={showScoreboardQr}
                onClick={() => {
                  setScoreboardUrl(
                    `${window.location.origin}/tournament/board/${publicToken}`,
                  );
                  setShowScoreboardQr((open) => !open);
                }}
              >
                <QrCode className="h-4 w-4" aria-hidden />
                Scoreboard QR
              </Button>
            ) : null}
          </div>
        </header>

        {showScoreboardQr && scoreboardUrl ? (
          <section className="flex flex-wrap items-center gap-6 rounded-2xl border border-white/10 bg-white/5 p-4">
            <SessionQr
              url={scoreboardUrl}
              alt="Scoreboard QR code"
              downloadFileName={scoreboardQrDownloadName(event.name)}
            />
            <div className="max-w-md space-y-2">
              <h2 className="font-[family-name:var(--font-display)] text-2xl">
                Scoreboard link
              </h2>
              <p className="text-sm text-white/70">
                Anyone who scans this can watch. They cannot enter scores.
              </p>
              <p className="break-all text-xs text-white/50">{scoreboardUrl}</p>
            </div>
          </section>
        ) : null}

        {clubs.length > 0 ? <ClubWins rows={clubs} /> : null}

        {playing.length === 0 ? (
          <p className="text-2xl text-white/70">
            Build the draw on the tournament desk, then leave this page on the
            gym TV.
          </p>
        ) : (
          <>
            <section className="space-y-4">
              <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--highlight)]">
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
            {upNext.length > 0 ? (
              <section className="space-y-4">
                <h2 className="text-sm uppercase tracking-[0.2em] text-white/50">
                  Up next
                </h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {upNext.map(({ category, match }, index) => (
                    <CourtTile
                      key={`${category.id}:${match.id}`}
                      state={category}
                      match={match}
                      queued
                      queuePosition={index + 1}
                    />
                  ))}
                </div>
              </section>
            ) : null}
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

type SponsorGroup = {
  tier: SponsorTier;
  logos: TournamentSponsor[];
};

function SponsorTicker({ sponsors }: { sponsors: TournamentSponsor[] }) {
  const logos = sponsors.filter((sponsor) => isSponsorLogoUrl(sponsor.url));
  const groups = SPONSOR_TIERS.map((tier) => ({
    tier,
    logos: logos.filter((sponsor) => sponsor.tier === tier),
  })).filter((group) => group.logos.length > 0);
  const layoutKey = groups
    .map(
      (group) =>
        `${group.tier}:${group.logos.map((sponsor) => sponsor.id).join(",")}`,
    )
    .join("|");
  const railRef = useRef<HTMLElement>(null);
  const unitRef = useRef<HTMLDivElement>(null);
  const [copies, setCopies] = useState(1);

  useLayoutEffect(() => {
    const rail = railRef.current;
    const unit = unitRef.current;
    if (!rail || !unit || layoutKey.length === 0) return;

    const sync = () => {
      const unitWidth = unit.getBoundingClientRect().width;
      const railWidth = rail.getBoundingClientRect().width;
      if (unitWidth <= 0 || railWidth <= 0) return;
      // Each animated half must span the viewport so a single logo still
      // paints a full-width bar and the -50% loop stays seamless.
      setCopies(Math.max(1, Math.ceil(railWidth / unitWidth)));
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(rail);
    observer.observe(unit);
    return () => observer.disconnect();
  }, [layoutKey]);

  if (groups.length === 0) return null;

  const seconds = Math.max(28, copies * 12 + logos.length * 4);
  return (
    <section
      ref={railRef}
      aria-label="Sponsors"
      className="fixed inset-x-0 bottom-0 z-30 overflow-hidden border-t border-white/10 bg-[var(--ink)]"
    >
      <div
        className="sponsor-ticker-track flex w-max items-stretch"
        style={{ ["--ticker-duration" as string]: `${seconds}s` }}
      >
        <TickerHalf groups={groups} copies={copies} />
        <TickerHalf groups={groups} copies={copies} copy />
      </div>
      <div
        className="pointer-events-none absolute top-0 -left-[9999px] -z-10 opacity-0"
        aria-hidden
      >
        <div ref={unitRef} className="flex w-max items-stretch">
          <TickerSequence groups={groups} />
        </div>
      </div>
    </section>
  );
}

function TickerHalf({
  groups,
  copies,
  copy = false,
}: {
  groups: SponsorGroup[];
  copies: number;
  copy?: boolean;
}) {
  return (
    <div
      className={
        copy ? "sponsor-ticker-copy flex min-w-full" : "flex min-w-full"
      }
      aria-hidden={copy || undefined}
    >
      {Array.from({ length: copies }, (_, index) => (
        <TickerSequence key={index} groups={groups} />
      ))}
    </div>
  );
}

function TickerSequence({ groups }: { groups: SponsorGroup[] }) {
  return (
    <div className="flex shrink-0 items-stretch">
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
  queued = false,
  queuePosition,
}: {
  state: TournamentState;
  match: TournamentMatch;
  queued?: boolean;
  queuePosition?: number;
}) {
  const group = state.groups.find((item) => item.id === match.groupId);
  const live = !queued && match.live?.serving ? match.live : null;
  const onCourt = !queued;
  return (
    <article
      className={
        onCourt
          ? "rounded-2xl border border-[var(--highlight)]/80 bg-[color-mix(in_srgb,var(--highlight)_16%,transparent)] p-4 shadow-[0_0_36px_-14px_color-mix(in_srgb,var(--highlight)_80%,transparent)]"
          : "rounded-2xl border border-white/10 bg-white/[0.03] p-4"
      }
    >
      <div className="mb-3 flex items-center justify-between gap-2 text-sm">
        <span
          className={
            onCourt
              ? "inline-flex items-center gap-2 text-base font-semibold text-[var(--highlight)]"
              : "text-white/45"
          }
        >
          {onCourt ? (
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-[var(--highlight)]"
              aria-hidden
            />
          ) : null}
          {queued
            ? queueLabel(queuePosition, match.number)
            : `Court ${match.courtNumber}`}
        </span>
        <span className="truncate text-white/50">
          {displayDivision(state)}
          {group ? ` · ${group.name}` : ` · M${match.number}`}
        </span>
      </div>
      <p className="text-sm text-white/50">
        Play to {pointsToWin(state, match)}
      </p>
      <ScoreLine
        name={teamName(state, match.teamAId)}
        score={live ? live.scoreA : null}
        prominent={onCourt}
      />
      <ScoreLine
        name={teamName(state, match.teamBId)}
        score={live ? live.scoreB : null}
        muted={!onCourt}
        prominent={onCourt}
      />
    </article>
  );
}

function queueLabel(position: number | undefined, matchNumber: number): string {
  if (position == null) return `M${matchNumber}`;
  if (position === 1) return `Next · M${matchNumber}`;
  return `${ordinal(position)} · M${matchNumber}`;
}

function ordinal(value: number): string {
  const ones = value % 10;
  const tens = value % 100;
  if (ones === 1 && tens !== 11) return `${value}st`;
  if (ones === 2 && tens !== 12) return `${value}nd`;
  if (ones === 3 && tens !== 13) return `${value}rd`;
  return `${value}th`;
}

function ScoreLine({
  name,
  score,
  muted = false,
  prominent = false,
}: {
  name: string;
  score: number | null;
  muted?: boolean;
  prominent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span
        className={
          prominent
            ? "min-w-0 truncate text-xl font-medium text-white"
            : muted
              ? "min-w-0 truncate text-lg text-white/55"
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
  const champion = bracketChampion(state);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--highlight)]">
            Knockout
          </p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl md:text-4xl">
            Finals
          </h2>
        </div>
        {champion ? (
          <p className="rounded-full border border-[var(--highlight)]/40 bg-[var(--highlight)]/10 px-4 py-1.5 text-sm text-[var(--highlight)]">
            Champion · {champion.name}
          </p>
        ) : null}
      </div>
      <div className="flex gap-5 overflow-x-auto pb-2">
        {columns.map((column, columnIndex) => {
          const lastRound = columnIndex === columns.length - 1;
          return (
            <div
              key={column.key}
              className={cn("shrink-0 space-y-4", lastRound ? "w-72" : "w-64")}
            >
              {column.groups.map((group) => (
                <div key={group.label} className="space-y-3">
                  <h3 className="text-xs uppercase tracking-[0.2em] text-white/45">
                    {group.label}
                  </h3>
                  {group.matches.map((match) => (
                    <BoardBracketMatch
                      key={match.id}
                      state={state}
                      match={match}
                      emphasize={
                        lastRound &&
                        !isThirdPlaceMatch(match) &&
                        match.status === "reported"
                      }
                    />
                  ))}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BoardBracketMatch({
  state,
  match,
  emphasize = false,
}: {
  state: TournamentState;
  match: TournamentMatch;
  emphasize?: boolean;
}) {
  const winnerId = matchWinnerId(match);
  const onCourt = match.courtNumber != null;
  const reported = match.status === "reported";

  if (match.status === "bye") {
    return (
      <article className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-3">
        <p className="text-sm text-white/55">
          {teamName(state, match.teamAId ?? match.teamBId)}
          <span className="ml-2 uppercase tracking-[0.14em]">Bye</span>
        </p>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "rounded-2xl border px-3 py-3 transition-colors",
        emphasize
          ? "border-[var(--highlight)]/50 bg-[var(--highlight)]/10 shadow-[0_0_40px_-18px_var(--board-glow)]"
          : onCourt
            ? "border-[var(--highlight)]/35 bg-white/5 ring-1 ring-[var(--highlight)]/20"
            : reported
              ? "border-white/15 bg-white/[0.06]"
              : "border-white/10 bg-white/[0.03]",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">
          M{match.number}
          {isThirdPlaceMatch(match) ? " · Bronze" : ""}
        </p>
        {onCourt ? (
          <span className="rounded-full bg-[var(--highlight)] px-2 py-0.5 text-[11px] font-medium text-[var(--ink)]">
            Court {match.courtNumber}
          </span>
        ) : reported ? (
          <span className="text-[11px] uppercase tracking-[0.14em] text-white/35">
            Complete
          </span>
        ) : null}
      </div>
      <div className="space-y-1">
        <BoardSide
          name={teamName(state, match.teamAId)}
          scores={match.games.map((game) => game.a)}
          won={winnerId != null && winnerId === match.teamAId}
          decided={winnerId != null}
          pending={!match.teamAId}
        />
        <BoardSide
          name={teamName(state, match.teamBId)}
          scores={match.games.map((game) => game.b)}
          won={winnerId != null && winnerId === match.teamBId}
          decided={winnerId != null}
          pending={!match.teamBId}
        />
      </div>
    </article>
  );
}

function BoardSide({
  name,
  scores,
  won = false,
  decided = false,
  pending = false,
}: {
  name: string;
  scores: number[];
  won?: boolean;
  decided?: boolean;
  pending?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl px-2.5 py-2",
        won && "bg-[var(--highlight)]/15",
        decided && !won && "opacity-55",
      )}
    >
      <span
        className={cn(
          "min-w-0 truncate text-base",
          won && "font-semibold text-[var(--highlight)]",
          pending && "text-white/35",
          decided && !won && "text-white/70",
        )}
      >
        {name}
      </span>
      {scores.length > 0 ? (
        <span
          className={cn(
            "shrink-0 tabular-nums",
            won
              ? "font-[family-name:var(--font-display)] text-2xl leading-none text-[var(--highlight)]"
              : "text-sm text-white/55",
          )}
        >
          {scores.join(" · ")}
        </span>
      ) : null}
    </div>
  );
}
