"use client";

import { useMemo, useState } from "react";
import { Volume2 } from "lucide-react";
import type { EngineAction, EngineMatch, EngineState } from "@/engine";
import {
  activeCourtBooking,
  bookableCourts,
  isMatchOvertime,
  matchRemainingMs,
  occupiedMatches,
  playerName,
  playersPerCourt,
  summarizeSession,
} from "@/engine";
import { BookingWindow } from "@/components/session/booking-window";
import { WaitingStackPanel } from "@/components/session/waiting-stack-panel";
import {
  DEFAULT_SKILL_TIER,
  formatSkillTier,
  type SkillTier,
} from "@/lib/skill-tier";
import { SkillTierSelect } from "@/components/ui/skill-tier-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CourtTimer } from "@/components/session/court-timer";
import { tryStackPush } from "@/lib/stack-push";
import {
  formatRemainingTimeAnnouncement,
  formatStartSessionAnnouncement,
  speakAnnouncement,
} from "@/lib/speech-announcer";
import { cn } from "@/lib/utils";

export function HostConsole({
  state,
  dispatch,
  boardUrl,
  onEndSession,
  readOnly = false,
  isPending,
  venueTimezone,
}: {
  state: EngineState;
  dispatch: (action: EngineAction) => void;
  boardUrl?: string;
  onEndSession?: () => void;
  readOnly?: boolean;
  /** When set, action buttons show a spinner until the live sync finishes. */
  isPending?: boolean;
  venueTimezone?: string;
}) {
  const [name, setName] = useState("");
  const [skill, setSkill] = useState<SkillTier>(DEFAULT_SKILL_TIER);
  const [lockA, setLockA] = useState("");
  const [lockB, setLockB] = useState("");
  const [teamLockIds, setTeamLockIds] = useState<string[]>(() =>
    Array.from({ length: 4 }, () => ""),
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const tracksPending = isPending !== undefined;
  const pending = isPending ?? false;
  const activeBusyKey = tracksPending && pending ? busyKey : null;
  const perCourt = playersPerCourt(state.mode);
  const courts = occupiedMatches(state);
  // Booked courts are unavailable, so they must not count as open capacity.
  const openCourtCount = bookableCourts(state).filter(
    (court) => !courts.some((match) => match.courtId === court.id),
  ).length;
  const waiting = state.players.filter((p) => p.status === "waiting");
  const resting = state.players.filter((p) => p.status === "resting");
  const rosterPlayers = state.players.filter((p) => p.status !== "left");
  const summary = useMemo(() => summarizeSession(state), [state]);

  function runBusy(key: string, action: () => void) {
    if (tracksPending) setBusyKey(key);
    action();
  }

  function checkIn() {
    const trimmed = name.trim();
    if (!trimmed) return;
    runBusy("check-in", () => {
      dispatch({
        type: "CHECK_IN",
        player: {
          id: `p_${trimmed.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`,
          name: trimmed,
          skill,
        },
      });
      setName("");
    });
  }

  function announceCourtRemainingTime(
    match: EngineMatch,
    courtName: string,
    now: number,
  ) {
    const remaining = matchRemainingMs(match, state.maxGameMinutes, now);
    const timeUp = isMatchOvertime(match, state.maxGameMinutes, now);
    speakAnnouncement(
      formatRemainingTimeAnnouncement(courtName, remaining, timeUp),
    );
  }

  function startMatch(match: EngineMatch, courtName: string) {
    const playerNames = [...match.teamA, ...match.teamB].map((id) =>
      playerName(state, id),
    );
    speakAnnouncement(formatStartSessionAnnouncement(courtName, playerNames));
    dispatch({ type: "START_MATCH", matchId: match.id });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Host console
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--foreground)]">
              Live open play
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {boardUrl ? (
              <Button variant="outline" size="sm" asChild>
                <a href={boardUrl} target="_blank" rel="noreferrer">
                  Open wallboard
                </a>
              </Button>
            ) : null}
            {onEndSession ? (
              <Button
                variant="danger"
                size="sm"
                loading={activeBusyKey === "end-session"}
                disabled={pending}
                onClick={() => runBusy("end-session", onEndSession)}
              >
                End session
              </Button>
            ) : null}
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {state.courts.map((court) => {
            const match = courts.find((m) => m.courtId === court.id);
            const booking = activeCourtBooking(court, state.now);
            // Keep showing a match that is already on court; the reservation
            // only owns the tile once the court is clear.
            const reservedAndClear = Boolean(booking) && !match;
            const statusLabel = match
              ? match.status === "ready"
                ? "Ready"
                : "Playing"
              : booking
                ? "Booked"
                : "Open";
            return (
              <article
                key={court.id}
                className={cn(
                  "rounded-xl border bg-[var(--surface)] p-4 shadow-[0_1px_0_rgba(0,0,0,0.04)]",
                  reservedAndClear && "border-amber-500/60 bg-amber-50/60",
                  match?.status === "active" && "border-[var(--accent)]/40",
                  match?.status === "ready" && "border-amber-400/50",
                  !reservedAndClear && !match && "border-[var(--border)]",
                )}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1">
                    <h2 className="font-semibold">{court.name}</h2>
                    {match?.status === "active" && !readOnly ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 px-0"
                        aria-label={`Announce remaining time for ${court.name}`}
                        onClick={() =>
                          announceCourtRemainingTime(
                            match,
                            court.name,
                            Date.now(),
                          )
                        }
                      >
                        <Volume2 className="h-4 w-4" aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs",
                      reservedAndClear
                        ? "bg-amber-200 text-amber-950"
                        : match?.status === "active"
                          ? "bg-[var(--accent-soft)] text-[var(--accent-fg-soft)]"
                          : match?.status === "ready"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-[var(--surface-2)] text-[var(--muted)]",
                    )}
                  >
                    {statusLabel}
                  </span>
                </div>
                {reservedAndClear && booking ? (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{booking.label}</p>
                    <BookingWindow
                      startsAt={booking.startsAt}
                      endsAt={booking.endsAt}
                      timeZone={venueTimezone}
                      className="block text-sm text-[var(--muted)]"
                    />
                    <p className="text-xs text-[var(--muted)]">
                      Reserved — unavailable for open play.
                    </p>
                  </div>
                ) : match ? (
                  <div className="space-y-3">
                    <CourtTimer
                      match={match}
                      maxGameMinutes={state.maxGameMinutes}
                    />
                    <TeamBlock label="Team A" ids={match.teamA} state={state} />
                    <div className="text-center text-xs uppercase tracking-widest text-[var(--muted)]">
                      vs
                    </div>
                    <TeamBlock label="Team B" ids={match.teamB} state={state} />
                    {booking ? (
                      <p className="rounded-md bg-amber-100 px-2 py-1.5 text-xs text-amber-950">
                        Reserved for {booking.label} — this court leaves open
                        play when the game ends.
                      </p>
                    ) : null}
                    {!readOnly ? (
                      <div className="flex flex-col gap-2 pt-1">
                        {match.status === "ready" ? (
                          <Button
                            size="sm"
                            className="w-full"
                            loading={activeBusyKey === `start-${match.id}`}
                            disabled={pending}
                            onClick={() =>
                              runBusy(`start-${match.id}`, () =>
                                startMatch(match, court.name),
                              )
                            }
                          >
                            Start session
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          className="w-full"
                          variant={
                            match.status === "active" ? "default" : "outline"
                          }
                          loading={activeBusyKey === `return-${match.id}`}
                          disabled={pending}
                          onClick={() =>
                            runBusy(`return-${match.id}`, () =>
                              dispatch({
                                type: "RETURN_TO_STACK",
                                matchId: match.id,
                              }),
                            )
                          }
                        >
                          Return to stack
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-[var(--muted)]">
                      Waiting for assignment
                    </p>
                    {!readOnly ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full"
                        loading={activeBusyKey === `push-${court.id}`}
                        disabled={
                          pending ||
                          waiting.length < (state.mode === "singles" ? 2 : 4)
                        }
                        onClick={() =>
                          runBusy(`push-${court.id}`, () =>
                            tryStackPush(state, dispatch, {
                              type: "PUSH_TO_COURT",
                              courtId: court.id,
                            }),
                          )
                        }
                      >
                        Push stack here
                      </Button>
                    ) : null}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {!readOnly ? (
          <WaitingStackPanel
            state={state}
            dispatch={dispatch}
            openCourtCount={openCourtCount}
            isPending={isPending}
            busyKey={activeBusyKey}
            onBusy={runBusy}
          />
        ) : null}
      </section>

      <aside className="space-y-4">
        {!readOnly ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="mb-3 font-semibold">Session settings</h2>
            <div className="space-y-1">
              <Label htmlFor="max-game-minutes">Max game timer (minutes)</Label>
              <Input
                id="max-game-minutes"
                type="number"
                min={1}
                max={60}
                value={state.maxGameMinutes}
                onChange={(e) =>
                  dispatch({
                    type: "SET_MAX_GAME_MINUTES",
                    minutes: Number(e.target.value) || 15,
                  })
                }
              />
              <p className="text-xs text-[var(--muted)]">
                Timer stops at zero and announces when a court session ends.
                Start each court manually once players are assigned.
              </p>
            </div>
          </div>
        ) : null}

        {!readOnly ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="mb-3 font-semibold">Check in</h2>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="player-name">Name</Label>
                <Input
                  id="player-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && checkIn()}
                  placeholder="Player name"
                />
              </div>
              <SkillTierSelect id="skill" value={skill} onChange={setSkill} />
              <Button
                className="w-full"
                loading={activeBusyKey === "check-in"}
                disabled={pending}
                onClick={checkIn}
              >
                Add player
              </Button>
            </div>
          </div>
        ) : null}

        {!readOnly ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="mb-3 font-semibold">Partner lock</h2>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm"
                value={lockA}
                onChange={(e) => setLockA(e.target.value)}
              >
                <option value="">Player A</option>
                {rosterPlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm"
                value={lockB}
                onChange={(e) => setLockB(e.target.value)}
              >
                <option value="">Player B</option>
                {rosterPlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              className="mt-3 w-full"
              variant="secondary"
              loading={activeBusyKey === "partner-lock"}
              disabled={pending || !lockA || !lockB || lockA === lockB}
              onClick={() =>
                runBusy("partner-lock", () => {
                  dispatch({
                    type: "SET_PARTNER_LOCK",
                    playerId: lockA,
                    partnerId: lockB,
                  });
                  dispatch({
                    type: "SET_PARTNER_LOCK",
                    playerId: lockB,
                    partnerId: lockA,
                  });
                })
              }
            >
              Lock partners
            </Button>
          </div>
        ) : null}

        {!readOnly && perCourt === 4 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="mb-1 font-semibold">Team lock</h2>
            <p className="mb-3 text-xs text-[var(--muted)]">
              Lock four players to always play together on the same court.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {teamLockIds.map((value, index) => (
                <select
                  key={index}
                  className="h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm"
                  value={value}
                  onChange={(e) =>
                    setTeamLockIds((prev) =>
                      prev.map((current, i) =>
                        i === index ? e.target.value : current,
                      ),
                    )
                  }
                >
                  <option value="">Player {index + 1}</option>
                  {waiting.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                className="flex-1"
                variant="secondary"
                loading={activeBusyKey === "team-lock"}
                disabled={
                  pending ||
                  teamLockIds.some((id) => !id) ||
                  new Set(teamLockIds).size !== 4
                }
                onClick={() =>
                  runBusy("team-lock", () => {
                    dispatch({ type: "SET_TEAM_LOCK", playerIds: teamLockIds });
                    setTeamLockIds(Array.from({ length: 4 }, () => ""));
                  })
                }
              >
                Lock team
              </Button>
              <Button
                className="flex-1"
                variant="outline"
                loading={activeBusyKey === "team-clear"}
                disabled={pending || !teamLockIds.some(Boolean)}
                onClick={() =>
                  runBusy("team-clear", () => {
                    const first = teamLockIds.find(Boolean);
                    if (first) {
                      dispatch({ type: "CLEAR_TEAM_LOCK", playerId: first });
                    }
                    setTeamLockIds(Array.from({ length: 4 }, () => ""));
                  })
                }
              >
                Clear
              </Button>
            </div>
          </div>
        ) : null}

        <QueueCard
          title="Resting"
          players={resting}
          state={state}
          dispatch={readOnly ? undefined : dispatch}
          isPending={pending}
          busyKey={activeBusyKey}
          onBusy={runBusy}
        />

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="mb-3 font-semibold">Leaderboard</h2>
          <ul className="space-y-2">
            {summary.slice(0, 8).map((row, i) => (
              <li
                key={row.playerId}
                className="flex items-center justify-between text-sm"
              >
                <span>
                  <span className="mr-2 text-[var(--muted)]">{i + 1}.</span>
                  {row.name}
                </span>
                <span className="tabular-nums text-[var(--muted)]">
                  {row.wins}W / {row.gamesPlayed}G
                </span>
              </li>
            ))}
            {summary.length === 0 ? (
              <li className="text-sm text-[var(--muted)]">No games yet</li>
            ) : null}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function TeamBlock({
  label,
  ids,
  state,
}: {
  label: string;
  ids: string[];
  state: EngineState;
}) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <ul className="space-y-1">
        {ids.map((id) => (
          <li key={id} className="text-sm font-medium">
            {playerName(state, id)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function QueueCard({
  title,
  players,
  state,
  dispatch,
  isPending = false,
  busyKey = null,
  onBusy,
}: {
  title: string;
  players: EngineState["players"];
  state: EngineState;
  dispatch?: (action: EngineAction) => void;
  isPending?: boolean;
  busyKey?: string | null;
  onBusy?: (key: string, action: () => void) => void;
}) {
  function run(key: string, action: () => void) {
    if (onBusy) onBusy(key, action);
    else action();
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="mb-3 font-semibold">
        {title} <span className="text-[var(--muted)]">({players.length})</span>
      </h2>
      <ul className="max-h-56 space-y-2 overflow-auto">
        {players.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <div>
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-[var(--muted)]">
                Skill {formatSkillTier(p.skill)} · {p.gamesPlayed} games
                {p.partnerLockId
                  ? ` · locked w/ ${playerName(state, p.partnerLockId)}`
                  : ""}
                {p.teamLockGroupId ? ` · team lock` : ""}
              </div>
            </div>
            {dispatch ? (
              <div className="flex shrink-0 gap-1">
                {p.status === "waiting" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={busyKey === `rest-${p.id}`}
                    disabled={isPending}
                    onClick={() =>
                      run(`rest-${p.id}`, () =>
                        dispatch({
                          type: "SET_STATUS",
                          playerId: p.id,
                          status: "resting",
                        }),
                      )
                    }
                  >
                    Rest
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={busyKey === `return-${p.id}`}
                    disabled={isPending}
                    onClick={() =>
                      run(`return-${p.id}`, () =>
                        dispatch({
                          type: "SET_STATUS",
                          playerId: p.id,
                          status: "waiting",
                        }),
                      )
                    }
                  >
                    Return
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-700 hover:bg-red-50 hover:text-red-800"
                  loading={busyKey === `remove-${p.id}`}
                  disabled={isPending}
                  onClick={() =>
                    run(`remove-${p.id}`, () =>
                      dispatch({
                        type: "SET_STATUS",
                        playerId: p.id,
                        status: "left",
                      }),
                    )
                  }
                >
                  Remove
                </Button>
              </div>
            ) : null}
          </li>
        ))}
        {players.length === 0 ? (
          <li className="text-sm text-[var(--muted)]">Empty</li>
        ) : null}
      </ul>
    </div>
  );
}
