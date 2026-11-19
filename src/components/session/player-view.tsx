"use client";

import type { EngineState } from "@/engine";
import {
  activeCourtBooking,
  occupiedMatches,
  orderedWaitingPlayers,
  playerName,
} from "@/engine";
import { BookingWindow } from "@/components/session/booking-window";
import { CourtTimer } from "@/components/session/court-timer";
import { formatBrandTitle, type FacilityConfig } from "@/lib/facility";
import { openPlayModeLabel } from "@/lib/open-play";
import { PUBLIC_COURT_HOLD_LABEL } from "@/lib/public-session-holds";
import { formatSkillTier } from "@/lib/skill-tier";

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
  const present = state.players.filter((player) => player.status !== "left");
  const formatLabel =
    state.format === "singles" || state.mode === "singles"
      ? "Singles"
      : "Doubles";
  const timeLabel =
    state.maxGameMinutes == null
      ? "No time limit"
      : `${state.maxGameMinutes} min games`;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <header className="space-y-2">
        <p className="text-xs tracking-wide text-[var(--muted)]">
          {formatBrandTitle(facility)}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl">
          {title.trim() || "Open play"}
        </h1>
        <p className="text-sm text-[var(--muted)]">
          {openPlayModeLabel(state.mode)} · {formatLabel} · {timeLabel} ·{" "}
          {present.length} {present.length === 1 ? "player" : "players"}
        </p>
        <p className="max-w-xl text-sm text-[var(--muted)]">
          The host adds players. This page follows the courts and the queue.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-semibold">Courts</h2>
        {state.courts.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Courts are not on this page yet. Refresh in a moment.
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
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
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="font-medium">{court.name}</h3>
                  <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
                    {status}
                  </span>
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
                    <p className="text-sm">
                      {match.teamA
                        .map((id) => playerName(state, id))
                        .join(" & ")}
                    </p>
                    <p className="text-xs uppercase tracking-widest text-[var(--muted)]">
                      vs
                    </p>
                    <p className="text-sm">
                      {match.teamB
                        .map((id) => playerName(state, id))
                        .join(" & ")}
                    </p>
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
                    Waiting for the next group
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Waiting ({waiting.length})</h2>
        {waiting.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No one is waiting.</p>
        ) : (
          <ol className="space-y-2">
            {waiting.map((player, index) => (
              <li
                key={player.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-sm"
              >
                <span>
                  {index + 1}. {player.name}
                </span>
                <span className="text-[var(--muted)]">
                  {formatSkillTier(player.skill)} · {player.gamesPlayed}G
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {resting.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-semibold">Resting ({resting.length})</h2>
          <ul className="space-y-2">
            {resting.map((player) => (
              <li
                key={player.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-sm"
              >
                <span>{player.name}</span>
                <span className="text-[var(--muted)]">
                  {player.gamesPlayed}G
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
