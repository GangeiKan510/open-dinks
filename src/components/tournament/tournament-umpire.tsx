"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  commitCategory,
  displayDivision,
  matchClaimHeldByOther,
  teamName,
  TournamentError,
  umpireChooseSide,
  umpireClaimMatch,
  umpireFinishGame,
  umpirePoint,
  umpireReleaseMatch,
  umpireSetFirstServer,
  umpireSetServer,
  umpireSideout,
  umpireTouchClaim,
  umpireUndo,
  type RallySide,
  type TournamentEvent,
  type TournamentMatch,
  type TournamentState,
} from "@/engine/tournament";
import { Button } from "@/components/ui/button";
import { saveUmpireDocument } from "@/lib/tournament-client";
import { tournamentEventFromDocument } from "@/lib/tournament-document";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type CourtAssignment = {
  category: TournamentState;
  match: TournamentMatch;
};

const UMPIRE_ID_KEY = "opendinks.umpire-id";
const CLAIM_HEARTBEAT_MS = 15_000;
let memoryUmpireId: string | null = null;

function clientUmpireId(): string {
  if (memoryUmpireId) return memoryUmpireId;
  try {
    const stored = sessionStorage.getItem(UMPIRE_ID_KEY);
    if (stored) {
      memoryUmpireId = stored;
      return stored;
    }
    memoryUmpireId = crypto.randomUUID();
    sessionStorage.setItem(UMPIRE_ID_KEY, memoryUmpireId);
    return memoryUmpireId;
  } catch {
    memoryUmpireId = crypto.randomUUID();
    return memoryUmpireId;
  }
}

function subscribeUmpireId() {
  return () => {};
}

export function TournamentUmpire({
  tournamentId,
  umpireToken,
  initialEvent,
}: {
  tournamentId: string;
  umpireToken: string;
  initialEvent: TournamentEvent;
}) {
  const [event, setEvent] = useState(initialEvent);
  const eventRef = useRef(initialEvent);
  const savedRef = useRef(initialEvent);
  const pendingRef = useRef(0);
  const saveSeq = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [court, setCourt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const umpireId = useSyncExternalStore(
    subscribeUmpireId,
    clientUmpireId,
    () => "",
  );

  const commit = useCallback(
    (next: TournamentEvent) => {
      eventRef.current = next;
      setEvent(next);
      const seq = ++saveSeq.current;
      pendingRef.current += 1;
      void saveUmpireDocument(umpireToken, next).then((result) => {
        pendingRef.current = Math.max(0, pendingRef.current - 1);
        if (seq !== saveSeq.current) return;
        if (!result.ok) {
          setError(
            result.missingSchema
              ? "Run the latest database migration, then try again."
              : "Could not save the score. Check your connection and try again.",
          );
          eventRef.current = savedRef.current;
          setEvent(savedRef.current);
          return;
        }
        savedRef.current = next;
      });
    },
    [umpireToken],
  );

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`tournament-umpire:${tournamentId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tournaments",
          filter: `id=eq.${tournamentId}`,
        },
        (payload) => {
          if (pendingRef.current > 0) return;
          const next = tournamentEventFromDocument(payload.new.document);
          if (!next) return;
          eventRef.current = next;
          savedRef.current = next;
          setEvent(next);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const assignments = onCourtAssignments(event);
  const owned = assignments.find(
    (item) => umpireId !== "" && item.match.claim?.umpireId === umpireId,
  );
  const selectedCourt = court ?? owned?.match.courtNumber ?? null;
  const active =
    assignments.find((item) => item.match.courtNumber === selectedCourt) ??
    null;
  const heldByOther = active
    ? matchClaimHeldByOther(active.match, umpireId, now)
    : false;
  const showing = active && !heldByOther ? active : null;

  const apply = useCallback(
    (
      categoryId: string,
      matchId: string,
      action: (category: TournamentState) => TournamentState,
    ) => {
      const current = eventRef.current;
      const category = current.categories.find(
        (item) => item.id === categoryId,
      );
      if (!category) return false;
      const match = category.matches.find((item) => item.id === matchId);
      if (match && matchClaimHeldByOther(match, umpireId, Date.now())) {
        setError("Another umpire is calling this court.");
        setCourt(null);
        return false;
      }
      try {
        commit(commitCategory(current, categoryId, action(category)));
        setError(null);
        return true;
      } catch (caught) {
        const message =
          caught instanceof TournamentError
            ? caught.message
            : "Could not update the score.";
        setError(message);
        if (message === "Another umpire is calling this court.") {
          setCourt(null);
        }
        return false;
      }
    },
    [commit, umpireId],
  );

  const showingCategoryId = showing?.category.id ?? null;
  const showingMatchId = showing?.match.id ?? null;

  useEffect(() => {
    if (!showingCategoryId || !showingMatchId) return;
    const categoryId = showingCategoryId;
    const matchId = showingMatchId;
    const beat = () => {
      apply(categoryId, matchId, (category) =>
        umpireTouchClaim(category, matchId, umpireId, Date.now()),
      );
    };
    const timer = window.setInterval(beat, CLAIM_HEARTBEAT_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [apply, showingCategoryId, showingMatchId, umpireId]);

  return (
    <div className="min-h-screen bg-[var(--ink)] text-[var(--paper)]">
      <div className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden px-4 pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {error ? (
          <p
            className="mb-4 rounded-xl bg-red-950 px-4 py-3 text-sm text-red-100"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {showing ? (
          <UmpireMatch
            key={`${showing.category.id}:${showing.match.id}:${showing.match.live?.gameIndex ?? 0}:${showing.match.games.length}`}
            eventName={event.name.trim() || "Club tournament"}
            category={showing.category}
            match={showing.match}
            canSwitch={assignments.length > 1}
            onSwitch={() => {
              apply(showing.category.id, showing.match.id, (category) =>
                umpireReleaseMatch(category, showing.match.id, umpireId),
              );
              setCourt(null);
            }}
            onChooseSide={(side) =>
              apply(showing.category.id, showing.match.id, (category) =>
                umpireChooseSide(
                  category,
                  showing.match.id,
                  side,
                  umpireId,
                  Date.now(),
                ),
              )
            }
            onSetServer={(server) =>
              apply(showing.category.id, showing.match.id, (category) =>
                umpireSetServer(
                  category,
                  showing.match.id,
                  server,
                  umpireId,
                  Date.now(),
                ),
              )
            }
            onSetFirstServer={(side, playerIndex) =>
              apply(showing.category.id, showing.match.id, (category) =>
                umpireSetFirstServer(
                  category,
                  showing.match.id,
                  side,
                  playerIndex,
                  umpireId,
                  Date.now(),
                ),
              )
            }
            onPoint={() =>
              apply(showing.category.id, showing.match.id, (category) =>
                umpirePoint(category, showing.match.id, umpireId, Date.now()),
              )
            }
            onSideout={() =>
              apply(showing.category.id, showing.match.id, (category) =>
                umpireSideout(category, showing.match.id, umpireId, Date.now()),
              )
            }
            onUndo={() =>
              apply(showing.category.id, showing.match.id, (category) =>
                umpireUndo(category, showing.match.id, umpireId, Date.now()),
              )
            }
            onFinish={() => {
              const courtNumber = showing.match.courtNumber;
              apply(showing.category.id, showing.match.id, (category) => {
                const next = umpireFinishGame(
                  category,
                  showing.match.id,
                  umpireId,
                  Date.now(),
                );
                const still = next.matches.find(
                  (match) =>
                    match.courtNumber === courtNumber &&
                    match.status === "unreported" &&
                    match.teamAId &&
                    match.teamBId,
                );
                if (!still || still.claim?.umpireId === umpireId) return next;
                if (matchClaimHeldByOther(still, umpireId, Date.now())) {
                  return next;
                }
                return umpireClaimMatch(next, still.id, umpireId, Date.now());
              });
            }}
          />
        ) : court != null && !active ? (
          <Waiting
            court={court}
            onSwitch={() => setCourt(null)}
            canSwitch={assignments.length > 0}
          />
        ) : (
          <CourtPicker
            eventName={event.name.trim() || "Club tournament"}
            assignments={assignments}
            umpireId={umpireId}
            now={now}
            onPick={(courtNumber) => {
              const item = assignments.find(
                (assignment) => assignment.match.courtNumber === courtNumber,
              );
              if (!item) return;
              const claimed = apply(
                item.category.id,
                item.match.id,
                (category) =>
                  umpireClaimMatch(
                    category,
                    item.match.id,
                    umpireId,
                    Date.now(),
                  ),
              );
              if (claimed) setCourt(courtNumber);
            }}
          />
        )}
      </div>
    </div>
  );
}

function onCourtAssignments(event: TournamentEvent): CourtAssignment[] {
  return event.categories
    .filter((category) => category.phase !== "setup")
    .flatMap((category) => {
      const stage = category.phase === "bracket" ? "bracket" : "groups";
      return category.matches
        .filter(
          (match) =>
            match.stage === stage &&
            match.status === "unreported" &&
            match.courtNumber != null &&
            match.teamAId &&
            match.teamBId,
        )
        .map((match) => ({ category, match }));
    })
    .sort(
      (left, right) =>
        (left.match.courtNumber ?? 0) - (right.match.courtNumber ?? 0),
    );
}

function CourtPicker({
  eventName,
  assignments,
  umpireId,
  now,
  onPick,
}: {
  eventName: string;
  assignments: CourtAssignment[];
  umpireId: string;
  now: number;
  onPick: (court: number) => void;
}) {
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
      <header>
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--lime)]">
          Umpire
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl">
          {eventName}
        </h1>
        <p className="mt-1 text-white/60">Choose the court you are calling.</p>
      </header>
      {assignments.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center text-white/70">
          No match is on a court yet. The desk assigns the next one.
        </p>
      ) : (
        <ul className="space-y-3">
          {assignments.map(({ category, match }) => {
            const taken = matchClaimHeldByOther(match, umpireId, now);
            return (
              <li key={`${category.id}:${match.id}`}>
                <button
                  type="button"
                  disabled={taken}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left disabled:opacity-50"
                  onClick={() => {
                    if (match.courtNumber != null) onPick(match.courtNumber);
                  }}
                >
                  <p className="text-sm text-[var(--lime)]">
                    Court {match.courtNumber}
                    {taken ? " · Being called" : ""}
                  </p>
                  <p className="mt-1 text-lg">
                    {teamName(category, match.teamAId)}
                  </p>
                  <p className="text-lg text-white/70">
                    {teamName(category, match.teamBId)}
                  </p>
                  <p className="mt-1 text-sm text-white/50">
                    {displayDivision(category)}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Waiting({
  court,
  canSwitch,
  onSwitch,
}: {
  court: number;
  canSwitch: boolean;
  onSwitch: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-4 text-center">
      <p className="text-xs uppercase tracking-[0.22em] text-[var(--lime)]">
        Court {court}
      </p>
      <h1 className="font-[family-name:var(--font-display)] text-4xl">
        Waiting for the next match
      </h1>
      <p className="text-white/60">
        This court is open. The next assignment shows up here.
      </p>
      {canSwitch ? (
        <Button
          type="button"
          variant="outline"
          className="mx-auto border-white/20 text-[var(--paper)]"
          onClick={onSwitch}
        >
          Other courts
        </Button>
      ) : null}
    </div>
  );
}

function UmpireMatch({
  eventName,
  category,
  match,
  canSwitch,
  onSwitch,
  onChooseSide,
  onSetServer,
  onSetFirstServer,
  onPoint,
  onSideout,
  onUndo,
  onFinish,
}: {
  eventName: string;
  category: TournamentState;
  match: TournamentMatch;
  canSwitch: boolean;
  onSwitch: () => void;
  onChooseSide: (side: RallySide) => void;
  onSetServer: (server: 1 | 2) => void;
  onSetFirstServer: (side: RallySide, playerIndex: 0 | 1) => void;
  onPoint: () => void;
  onSideout: () => void;
  onUndo: () => void;
  onFinish: () => void;
}) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const live = match.live;
  const scoreA = live?.scoreA ?? 0;
  const scoreB = live?.scoreB ?? 0;
  const serving = live?.serving ?? null;
  const server = live?.server ?? 2;
  const gameNumber = (live?.gameIndex ?? match.games.length) + 1;
  const canScore = serving != null;
  const canUndo = (live?.past.length ?? 0) > 0;
  const tied = scoreA === scoreB;
  const playersA = teamPlayers(category, match.teamAId);
  const playersB = teamPlayers(category, match.teamBId);
  const servingPlayers =
    serving === "a" ? playersA : serving === "b" ? playersB : null;
  const servingFirst =
    serving === "a"
      ? (live?.firstServerA ?? null)
      : serving === "b"
        ? (live?.firstServerB ?? null)
        : null;
  const servingPlayer =
    servingPlayers && servingFirst != null
      ? servingPlayers[server === 1 ? servingFirst : servingFirst === 0 ? 1 : 0]
      : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="mb-3 flex shrink-0 items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--lime)]">
            {eventName}
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl">
            Court {match.courtNumber}
          </h1>
          <p className="text-sm text-white/60">
            {displayDivision(category)} · Game {gameNumber} of{" "}
            {category.gamesPerMatch}
          </p>
        </div>
        {canSwitch ? (
          <Button
            type="button"
            variant="ghost"
            className="text-[var(--paper)] hover:bg-white/10"
            onClick={onSwitch}
          >
            Courts
          </Button>
        ) : null}
      </header>

      {match.games.length > 0 ? (
        <p className="mb-3 text-sm text-white/50">
          {match.games
            .map((game, index) => `Game ${index + 1}: ${game.a}–${game.b}`)
            .join("  ·  ")}
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 content-start grid-cols-1 gap-2 overflow-auto">
        <TeamScore
          name={teamName(category, match.teamAId)}
          players={playersA}
          firstServer={live?.firstServerA ?? null}
          score={scoreA}
          serving={serving === "a"}
          server={server}
          onChooseSide={() => onChooseSide("a")}
          onSetFirstServer={(playerIndex) => onSetFirstServer("a", playerIndex)}
        />
        <TeamScore
          name={teamName(category, match.teamBId)}
          players={playersB}
          firstServer={live?.firstServerB ?? null}
          score={scoreB}
          serving={serving === "b"}
          server={server}
          onChooseSide={() => onChooseSide("b")}
          onSetFirstServer={(playerIndex) => onSetFirstServer("b", playerIndex)}
        />
      </div>

      <p className="shrink-0 py-2 text-center text-sm text-white/60">
        {serving
          ? `${servingPlayer ?? teamName(category, serving === "a" ? match.teamAId : match.teamBId)} · ${server === 1 ? "1st" : "2nd"} server`
          : "Tap a player to mark that team's first server, then tap the team that serves."}
      </p>

      <div className="shrink-0 space-y-2">
        <div className="grid grid-cols-2 gap-3">
          <ServerButton
            label="1st server"
            pressed={server === 1}
            onClick={() => onSetServer(1)}
          />
          <ServerButton
            label="2nd server"
            pressed={server === 2}
            onClick={() => onSetServer(2)}
          />
        </div>
        {confirmEnd ? (
          <div className="space-y-3 rounded-2xl border border-white/15 bg-white/5 p-4">
            <p className="text-center text-lg">
              End this game {scoreA}–{scoreB}?
            </p>
            <Button
              type="button"
              className="h-14 w-full text-lg"
              onClick={() => {
                setConfirmEnd(false);
                onFinish();
              }}
            >
              End game
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full border-white/20 text-[var(--paper)]"
              onClick={() => setConfirmEnd(false)}
            >
              Keep playing
            </Button>
          </div>
        ) : (
          <>
            <Button
              type="button"
              className="h-20 w-full rounded-2xl bg-[var(--lime)] text-2xl text-[var(--ink)] hover:bg-[var(--lime)]"
              disabled={!canScore}
              onClick={onPoint}
            >
              Point
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-16 w-full rounded-2xl border-white/20 text-xl text-[var(--paper)] hover:bg-white/10"
              disabled={!canScore}
              onClick={onSideout}
            >
              Sideout
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="ghost"
                className="h-12 text-[var(--paper)] hover:bg-white/10"
                disabled={!canUndo}
                onClick={onUndo}
              >
                Undo
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-12 bg-white/10 text-[var(--paper)] hover:bg-white/15"
                disabled={!canScore || tied}
                onClick={() => setConfirmEnd(true)}
              >
                End game
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function teamPlayers(
  state: TournamentState,
  teamId: string | null,
): [string, string] | null {
  if (!teamId) return null;
  const players = state.teams.find((team) => team.id === teamId)?.players;
  if (!players || !players[0] || !players[1]) return null;
  return [players[0], players[1]];
}

function activePlayerIndex(
  firstServer: 0 | 1 | null,
  server: 1 | 2,
): 0 | 1 | null {
  if (firstServer == null) return null;
  if (server === 1) return firstServer;
  return firstServer === 0 ? 1 : 0;
}

function TeamScore({
  name,
  players,
  firstServer,
  score,
  serving,
  server,
  onChooseSide,
  onSetFirstServer,
}: {
  name: string;
  players: [string, string] | null;
  firstServer: 0 | 1 | null;
  score: number;
  serving: boolean;
  server: 1 | 2;
  onChooseSide: () => void;
  onSetFirstServer: (playerIndex: 0 | 1) => void;
}) {
  const active = serving ? activePlayerIndex(firstServer, server) : null;
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3",
        serving
          ? "border-[var(--lime)] bg-[var(--lime)]/15"
          : "border-white/10 bg-white/5",
      )}
    >
      <button type="button" onClick={onChooseSide} className="w-full text-left">
        <span className="flex items-center justify-between gap-3">
          <span className="text-lg leading-tight">{name}</span>
          {serving ? (
            <span className="shrink-0 rounded-full bg-[var(--lime)] px-2 py-0.5 text-xs font-medium text-[var(--ink)]">
              {active != null && players
                ? players[active]
                : server === 1
                  ? "1st server"
                  : "2nd server"}
            </span>
          ) : null}
        </span>
        <span className="mt-1 block font-[family-name:var(--font-display)] text-5xl tabular-nums">
          {score}
        </span>
      </button>
      {players ? (
        <span className="mt-2 grid grid-cols-2 gap-2">
          {players.map((player, index) => {
            const slot = index === 0 ? 0 : 1;
            const tagged = firstServer === slot;
            const up = active === slot;
            return (
              <button
                key={slot}
                type="button"
                aria-pressed={tagged}
                onClick={() => onSetFirstServer(slot)}
                className={cn(
                  "h-10 rounded-full border px-2 text-sm",
                  up
                    ? "border-[var(--lime)] bg-[var(--lime)] text-[var(--ink)]"
                    : tagged
                      ? "border-[var(--lime)] text-[var(--lime)]"
                      : "border-white/20 text-white/80",
                )}
              >
                {player}
                {tagged ? " · 1st" : ""}
              </button>
            );
          })}
        </span>
      ) : null}
    </div>
  );
}

function ServerButton({
  label,
  pressed,
  onClick,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={pressed}
      className={cn(
        "h-14 text-base",
        pressed
          ? "border-[var(--lime)] bg-[var(--lime)] text-[var(--ink)] hover:bg-[var(--lime)]"
          : "border-white/20 text-[var(--paper)] hover:bg-white/10",
      )}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
