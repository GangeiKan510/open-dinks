"use client";

import {
  Clock,
  LayoutGrid,
  ListOrdered,
  Moon,
  Radio,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { EnginePlayer, EngineState } from "@/engine";
import {
  activeCourtBooking,
  groupWaitingStack,
  occupiedMatches,
  orderedWaitingPlayers,
  playerName,
  playersPerCourt,
} from "@/engine";
import { BookingWindow } from "@/components/session/booking-window";
import { CourtTimer } from "@/components/session/court-timer";
import {
  RaceTag,
  SessionHonors,
  SessionStandings,
} from "@/components/session/session-race-panel";
import { formatBrandTitle, type FacilityConfig } from "@/lib/facility";
import { openPlayModeLabel } from "@/lib/open-play";
import { PUBLIC_COURT_HOLD_LABEL } from "@/lib/public-session-holds";
import {
  formatRecord,
  raceRow,
  sessionRace,
  type SessionRace,
} from "@/lib/session-race";
import { formatSkillTier } from "@/lib/skill-tier";
import { cn } from "@/lib/utils";

const CARD =
  "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[inset_0_1px_0_0_color-mix(in_srgb,var(--highlight)_16%,transparent)]";

export function PlayerView({
  state,
  facility = null,
  title,
  venueTimezone,
}: {
  state: EngineState;
  facility?: FacilityConfig | null;
  title: string;
  venueTimezone?: string;
}) {
  const matches = occupiedMatches(state);
  const waiting = orderedWaitingPlayers(state);
  const resting = state.players.filter((player) => player.status === "resting");
  const race = sessionRace(state);
  const present = state.players.filter((player) => player.status !== "left");
  const perCourt = playersPerCourt(state);
  const fullGroups = groupWaitingStack(waiting, perCourt).filter(
    (group) => group.length === perCourt,
  );
  const nextGames = fullGroups.slice(0, Math.max(state.courts.length, 1));
  const nextIds =
    nextGames.length > 0
      ? new Set(nextGames.flat().map((player) => player.id))
      : new Set(waiting.map((player) => player.id));
  const later = waiting.filter((player) => !nextIds.has(player.id));
  const liveCount = matches.filter((match) => match.status === "active").length;
  const formatLabel =
    state.format === "singles" || state.mode === "singles"
      ? "Singles"
      : "Doubles";
  const timeLabel =
    state.maxGameMinutes == null
      ? "No time limit"
      : `${state.maxGameMinutes} min games`;

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-8 md:px-6">
      <header className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--highlight)]">
            {formatBrandTitle(facility)}
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl">
            {title.trim() || "Open play"}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            {openPlayModeLabel(state.mode)} · {formatLabel} · {timeLabel}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat icon={Users} label="Here" value={present.length} />
          <Stat icon={Radio} label="Live" value={liveCount} />
          <Stat icon={ListOrdered} label="In line" value={waiting.length} />
          <Stat icon={Moon} label="Resting" value={resting.length} />
        </dl>
      </header>

      <section className="space-y-4">
        <SectionTitle icon={LayoutGrid} kicker="Now" title="Courts" />
        {state.courts.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Courts are not on this page yet. Refresh in a moment.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {state.courts.map((court) => {
              const match = matches.find((item) => item.courtId === court.id);
              const booking = activeCourtBooking(court, state.now);
              const status = match
                ? match.status === "active"
                  ? "Live"
                  : "Ready"
                : booking
                  ? "Booked"
                  : "Open";

              return (
                <article
                  key={court.id}
                  className={cn(
                    CARD,
                    match?.status === "active" &&
                      "border-[var(--highlight)]/40",
                    match?.status === "ready" && "border-amber-400/40",
                    booking && !match && "border-amber-400/40",
                  )}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="font-medium">{court.name}</h3>
                    <StatusPill status={status} />
                  </div>
                  {booking && !match ? (
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">{booking.label}</p>
                      <BookingWindow
                        startsAt={booking.startsAt}
                        endsAt={booking.endsAt}
                        timeZone={venueTimezone}
                        className="block text-[var(--muted)]"
                      />
                      <p className="text-xs text-[var(--muted)]">
                        Reserved · not in open play
                      </p>
                    </div>
                  ) : match ? (
                    <div className="space-y-3">
                      <CourtTimer
                        match={match}
                        maxGameMinutes={state.maxGameMinutes}
                        compact
                      />
                      <NameStack ids={match.teamA} state={state} />
                      <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
                        <span className="h-px flex-1 bg-[var(--border)]" />
                        vs
                        <span className="h-px flex-1 bg-[var(--border)]" />
                      </div>
                      <NameStack ids={match.teamB} state={state} />
                      {booking ? (
                        <p className="text-xs text-[var(--muted)]">
                          {booking.label === PUBLIC_COURT_HOLD_LABEL
                            ? "Reserved next."
                            : `Reserved next for ${booking.label}.`}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--muted)]">
                      Open for the next group
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <SectionTitle
          icon={ListOrdered}
          kicker="Up next"
          title="Next games"
          detail="The front of the line. The host sends a group out when a court frees up."
        />
        {nextGames.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--muted)]">
              {waiting.length === 0
                ? "The line is empty."
                : `Need ${perCourt - waiting.length} more ${
                    perCourt - waiting.length === 1 ? "player" : "players"
                  } before the next game is full.`}
            </p>
            {waiting.length > 0 ? (
              <ol className="space-y-2">
                {waiting.map((player, index) => (
                  <li key={player.id} className={cn(CARD, "py-2.5")}>
                    <QueueName player={player} race={race} index={index} />
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {nextGames.map((group, index) => (
              <article
                key={group.map((player) => player.id).join("-")}
                className={cn(
                  CARD,
                  index === 0 && "border-[var(--highlight)]/35",
                )}
              >
                <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--highlight)]">
                  {nextGameLabel(index)}
                </h3>
                <ol className="mt-3 space-y-2">
                  {group.map((player, playerIndex) => (
                    <li key={player.id}>
                      <QueueName
                        player={player}
                        race={race}
                        index={index * perCourt + playerIndex}
                      />
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        )}
      </section>

      <SessionHonors race={race} />
      <SessionStandings race={race} />

      {later.length > 0 ? (
        <section className="space-y-4">
          <SectionTitle
            icon={Clock}
            kicker="Queue"
            title={`Later in line (${later.length})`}
          />
          <ol className="space-y-2">
            {later.map((player, index) => (
              <li
                key={player.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm"
              >
                <QueueName
                  player={player}
                  race={race}
                  index={nextGames.length * perCourt + index}
                />
                <span className="shrink-0 text-xs text-[var(--muted)]">
                  {formatSkillTier(player.skill)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {resting.length > 0 ? (
        <section className="space-y-4">
          <SectionTitle
            icon={Moon}
            kicker="Sitting out"
            title={`Resting (${resting.length})`}
          />
          <ul className="space-y-2">
            {resting.map((player) => (
              <li
                key={player.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm"
              >
                <QueueName player={player} race={race} />
                <span className="shrink-0 text-xs text-[var(--muted)]">
                  {player.gamesPlayed} played
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  kicker,
  title,
  detail,
}: {
  icon: LucideIcon;
  kicker: string;
  title: string;
  detail?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--highlight)]">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {kicker}
      </p>
      <h2 className="font-[family-name:var(--font-display)] text-2xl">
        {title}
      </h2>
      {detail ? <p className="text-sm text-[var(--muted)]">{detail}</p> : null}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <div className={CARD}>
      <dt className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
        <Icon className="h-3.5 w-3.5 text-[var(--highlight)]" aria-hidden />
        {label}
      </dt>
      <dd className="mt-1 font-[family-name:var(--font-display)] text-2xl tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function StatusPill({
  status,
}: {
  status: "Live" | "Ready" | "Booked" | "Open";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
        status === "Live" && "bg-[var(--highlight)]/15 text-[var(--highlight)]",
        (status === "Ready" || status === "Booked") &&
          "bg-amber-400/15 text-amber-200",
        status === "Open" && "bg-[var(--surface-2)] text-[var(--muted)]",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "Live" ? "bg-[var(--highlight)]" : "bg-current",
        )}
        aria-hidden
      />
      {status}
    </span>
  );
}

function NameStack({ ids, state }: { ids: string[]; state: EngineState }) {
  return (
    <ul className="space-y-1">
      {ids.map((id) => (
        <li key={id} className="text-sm font-medium">
          {playerName(state, id)}
        </li>
      ))}
    </ul>
  );
}

function QueueName({
  player,
  race,
  index,
}: {
  player: EnginePlayer;
  race: SessionRace;
  index?: number;
}) {
  const row = raceRow(race, player.id);
  const record =
    row && row.decided > 0 ? formatRecord(row.wins, row.losses) : null;

  return (
    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
      {index != null ? (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[10px] font-semibold tabular-nums text-[var(--highlight)]">
          {index + 1}
        </span>
      ) : null}
      <span className="min-w-0 truncate font-medium">{player.name}</span>
      {row?.tag ? <RaceTag tag={row.tag} /> : null}
      {record ? (
        <span className="shrink-0 tabular-nums text-xs text-[var(--muted)]">
          {record}
        </span>
      ) : null}
    </span>
  );
}

function nextGameLabel(index: number): string {
  if (index === 0) return "Next game";
  if (index === 1) return "On deck";
  return `Game ${index + 1}`;
}
