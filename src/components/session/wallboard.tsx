"use client";

import { useEffect } from "react";
import type { EngineState } from "@/engine";
import { activeCourtBooking, occupiedMatches, playerName } from "@/engine";
import { BookingWindow } from "@/components/session/booking-window";
import { CourtAnnouncer } from "@/components/session/court-announcer";
import { CourtTimer } from "@/components/session/court-timer";
import { formatBrandTitle, type FacilityConfig } from "@/lib/facility";
import { primeSpeechAnnouncer } from "@/lib/speech-announcer";

export function Wallboard({
  state,
  facility = null,
  venueTimezone,
}: {
  state: EngineState;
  facility?: FacilityConfig | null;
  venueTimezone?: string;
}) {
  const courts = occupiedMatches(state);
  const waiting = state.players.filter((p) => p.status === "waiting");

  useEffect(() => {
    primeSpeechAnnouncer();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--ink)] text-[var(--paper)]">
      <CourtAnnouncer state={state} enabled />
      <div className="mx-auto grid min-h-screen max-w-[1600px] grid-rows-[auto_1fr] gap-6 p-6 md:p-10">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="text-sm tracking-wide text-[var(--lime)]">
              {formatBrandTitle(facility)}
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl">
              Open play
            </h1>
          </div>
          <div className="text-right text-sm text-white/60">
            <div>
              {state.players.filter((p) => p.status !== "left").length} players
            </div>
            <div className="capitalize">{state.mode.replaceAll("_", " ")}</div>
            <div>Max {state.maxGameMinutes} min</div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {state.courts.map((court) => {
              const match = courts.find((m) => m.courtId === court.id);
              const booking = activeCourtBooking(court, state.now);
              // A match already on court keeps its tile; the booking only takes
              // the display over once the court is actually clear.
              const badge = match
                ? match.status === "active"
                  ? "LIVE"
                  : "READY"
                : booking
                  ? "BOOKED"
                  : "OPEN";
              return (
                <article
                  key={court.id}
                  className={
                    booking && !match
                      ? "rounded-2xl border border-amber-300/40 bg-amber-300/10 p-5 backdrop-blur"
                      : "rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"
                  }
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-2xl font-semibold">{court.name}</h2>
                    <span
                      className={
                        booking && !match
                          ? "rounded-full bg-amber-300/20 px-3 py-1 text-xs text-amber-200"
                          : match
                            ? "rounded-full bg-[var(--lime)]/20 px-3 py-1 text-xs text-[var(--lime)]"
                            : "rounded-full bg-white/10 px-3 py-1 text-xs text-white/50"
                      }
                    >
                      {badge}
                    </span>
                  </div>
                  {booking && !match ? (
                    <div className="space-y-2">
                      <p className="text-xl font-semibold text-amber-100">
                        {booking.label}
                      </p>
                      <BookingWindow
                        startsAt={booking.startsAt}
                        endsAt={booking.endsAt}
                        timeZone={venueTimezone}
                        className="block text-lg text-amber-200/80"
                      />
                      <p className="text-sm text-amber-200/60">
                        Reserved · not in open play
                      </p>
                    </div>
                  ) : match ? (
                    <div className="space-y-4 text-lg">
                      <CourtTimer
                        match={match}
                        maxGameMinutes={state.maxGameMinutes}
                        tone="dark"
                      />
                      <div>
                        {match.teamA.map((id) => (
                          <div key={id}>{playerName(state, id)}</div>
                        ))}
                      </div>
                      <div className="text-xs uppercase tracking-[0.3em] text-white/40">
                        versus
                      </div>
                      <div>
                        {match.teamB.map((id) => (
                          <div key={id}>{playerName(state, id)}</div>
                        ))}
                      </div>
                      {booking ? (
                        <p className="rounded-lg bg-amber-300/15 px-3 py-2 text-sm text-amber-200">
                          Reserved for {booking.label} — last game on this
                          court.
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-white/40">Next group loading…</p>
                  )}
                </article>
              );
            })}
          </div>

          <aside className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-4 text-2xl font-semibold">Queue</h2>
            <ol className="space-y-3">
              {waiting.map((p, i) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between border-b border-white/5 pb-2 text-lg"
                >
                  <span>
                    <span className="mr-3 text-[var(--lime)]">{i + 1}</span>
                    {p.name}
                  </span>
                  <span className="text-sm text-white/40">
                    {p.gamesPlayed}G
                  </span>
                </li>
              ))}
              {waiting.length === 0 ? (
                <li className="text-white/40">Queue empty</li>
              ) : null}
            </ol>
          </aside>
        </div>
      </div>
    </div>
  );
}
