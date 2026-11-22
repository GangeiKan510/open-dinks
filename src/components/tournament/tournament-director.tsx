"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Check,
  LayoutDashboard,
  Monitor,
  QrCode,
  TriangleAlert,
  Trophy,
} from "lucide-react";
import {
  activeCategory,
  addCategory,
  addClub,
  addSponsor,
  addSampleTeams,
  addTeam,
  assignTeamBracket,
  assignTeamClub,
  autoAssignBrackets,
  bracketAssignmentIssue,
  bracketBlockReason,
  bracketName,
  bracketChampion,
  bracketColumns,
  canUndoDraw,
  clearMatchScore,
  commitCategory,
  displayDivision,
  displayTournamentName,
  generateBracket,
  generateGroups,
  groupStandings,
  MAX_SPONSOR_LOGOS,
  planBracketSizes,
  removeCategory,
  removeClub,
  removeSponsor,
  removeTeam,
  renameTeam,
  isSponsorTier,
  setSponsorTier,
  SPONSOR_TIER_LABELS,
  SPONSOR_TIERS,
  reportMatchScore,
  selectCategory,
  setCategoryCourts,
  setCategoryFormat,
  setDrawSettings,
  stageProgress,
  swapMatches,
  teamName,
  unparkMatch,
  upcomingMatches,
  wildcardTeamIds,
  undoUnscoredDraw,
  TournamentError,
  updateTournamentDetails,
  type GameScore,
  type TournamentEvent,
  type TournamentMatch,
  type SponsorTier,
  type TournamentSponsor,
  type TournamentState,
} from "@/engine/tournament";
import { MatchCard } from "@/components/tournament/match-card";
import { SessionQr } from "@/components/session/session-qr";
import { StandingsTable } from "@/components/tournament/standings-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { bracketBuildNotice } from "@/lib/entitlements";
import { PRODUCT_NAME } from "@/lib/facility";
import { deleteSponsorLogo, uploadSponsorLogo } from "@/lib/sponsor-logo";
import { saveTournamentDocument } from "@/lib/tournament-client";
import { isNewerTimestamp } from "@/lib/umpire-patches";
import {
  LEGACY_TOURNAMENT_STORAGE_KEY,
  readLegacyTournament,
  shouldAdoptLocalTournament,
  tournamentEventFromDocument,
} from "@/lib/tournament-document";
import { createClient } from "@/lib/supabase/client";

type MatchFilter = "unreported" | "reported" | "court" | "all";
type LiveView = "groups" | "bracket" | "settings";

/** Coalesce rapid director edits before writing the full tournament document. */
const DIRECTOR_SAVE_DEBOUNCE_MS = 400;

function resolveLiveView(
  phase: TournamentState["phase"],
  picked: LiveView | null,
): LiveView {
  if (picked === "settings") return "settings";
  if (phase === "bracket") {
    if (picked === "groups" || picked === "bracket") return picked;
    return "bracket";
  }
  return "groups";
}

export function TournamentDirector({
  tournamentId,
  publicToken,
  umpireToken,
  initialEvent,
  initialUpdatedAt,
  bracketsOpen,
  bracketDates,
}: {
  tournamentId: string;
  publicToken: string;
  umpireToken: string;
  initialEvent: TournamentEvent;
  initialUpdatedAt: string;
  bracketsOpen: boolean;
  bracketDates: string;
}) {
  const [event, setEvent] = useState(initialEvent);
  const savedRef = useRef(initialEvent);
  const pendingRef = useRef(0);
  const pendingEventRef = useRef<TournamentEvent | null>(null);
  const savingRef = useRef(false);
  const waitersRef = useRef<Array<(ok: boolean) => void>>([]);
  const flushRef = useRef<() => Promise<void>>(async () => {});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updatedAtRef = useRef(initialUpdatedAt);
  const remoteRef = useRef<{
    event: TournamentEvent;
    updatedAt: string;
  } | null>(null);
  const state = activeCategory(event);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<LiveView | null>(null);
  const [filter, setFilter] = useState<MatchFilter>("unreported");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [undoOpen, setUndoOpen] = useState(false);
  const [showUmpire, setShowUmpire] = useState(false);
  const [umpireUrl, setUmpireUrl] = useState<string | null>(null);
  const [desk, setDesk] = useState<"tournament" | "sponsors">("tournament");
  const view = resolveLiveView(state.phase, picked);

  const adopt = useCallback((next: TournamentEvent, updatedAt: string) => {
    if (
      updatedAtRef.current &&
      !isNewerTimestamp(updatedAt, updatedAtRef.current)
    ) {
      return;
    }
    updatedAtRef.current = updatedAt;
    savedRef.current = next;
    setEvent(next);
  }, []);

  const settle = useCallback((ok: boolean) => {
    const waiters = waitersRef.current;
    waitersRef.current = [];
    for (const waiter of waiters) waiter(ok);
  }, []);

  const flush = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    pendingRef.current += 1;
    try {
      while (pendingEventRef.current) {
        const next = pendingEventRef.current;
        pendingEventRef.current = null;
        const result = await saveTournamentDocument(
          tournamentId,
          next,
          updatedAtRef.current,
        );
        if (!result.ok) {
          pendingEventRef.current = null;
          if (result.conflict && result.event && result.updatedAt) {
            updatedAtRef.current = "";
            adopt(result.event, result.updatedAt);
            setError(
              "Scores changed on another court. Reloaded the latest tournament.",
            );
          } else {
            setError(
              result.missingSchema
                ? "Run the latest database migration, then try again."
                : "Could not save the tournament. Check your connection and try again.",
            );
            setEvent(savedRef.current);
          }
          settle(false);
          return;
        }
        updatedAtRef.current = result.updatedAt;
        savedRef.current = next;
        setError(null);
      }
      const remote = remoteRef.current;
      if (remote && isNewerTimestamp(remote.updatedAt, updatedAtRef.current)) {
        adopt(remote.event, remote.updatedAt);
      }
      settle(true);
    } catch {
      pendingEventRef.current = null;
      setError(
        "Could not save the tournament. Check your connection and try again.",
      );
      setEvent(savedRef.current);
      settle(false);
    } finally {
      savingRef.current = false;
      pendingRef.current = 0;
      if (pendingEventRef.current) void flushRef.current();
    }
  }, [adopt, setError, settle, tournamentId]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const scheduleFlush = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void flushRef.current();
    }, DIRECTOR_SAVE_DEBOUNCE_MS);
  }, []);

  const commit = useCallback(
    (next: TournamentEvent) => {
      setEvent(next);
      pendingEventRef.current = next;
      const pending = new Promise<boolean>((resolve) => {
        waitersRef.current.push(resolve);
      });
      // Coalesce rapid edits (name typing, toggles) into one document write
      // so Realtime does not fan out a full tournament blob on every keystroke.
      scheduleFlush();
      return pending;
    },
    [scheduleFlush],
  );

  useEffect(() => {
    const local = readLegacyTournament(
      window.localStorage.getItem(LEGACY_TOURNAMENT_STORAGE_KEY),
    );
    if (!local || !shouldAdoptLocalTournament(savedRef.current, local)) return;
    window.localStorage.removeItem(LEGACY_TOURNAMENT_STORAGE_KEY);
    commit(local);
  }, [commit]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`tournament:${tournamentId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tournaments",
          filter: `id=eq.${tournamentId}`,
        },
        (payload) => {
          const row = payload.new as {
            document?: unknown;
            updated_at?: unknown;
          };
          const next = tournamentEventFromDocument(row.document);
          if (!next || typeof row.updated_at !== "string") return;
          remoteRef.current = { event: next, updatedAt: row.updated_at };
          if (pendingRef.current > 0 || pendingEventRef.current) return;
          adopt(next, row.updated_at);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      void flushRef.current();
    };
  }, [adopt, tournamentId]);

  function runEvent(action: () => TournamentEvent): boolean {
    try {
      commit(action());
      setError(null);
      setConfirmRemove(false);
      return true;
    } catch (caught) {
      setError(
        caught instanceof TournamentError
          ? caught.message
          : "Could not update the draw.",
      );
      return false;
    }
  }

  function run(action: () => TournamentState): boolean {
    return runEvent(() => commitCategory(event, state.id, action()));
  }

  function report(matchId: string, games: GameScore[]) {
    run(() => reportMatchScore(state, matchId, games));
  }

  function clear(matchId: string) {
    run(() => clearMatchScore(state, matchId));
  }

  const champion = bracketChampion(state);
  const bracketNotice = bracketBuildNotice(bracketDates);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
            <Link href="/" className="hover:underline">
              {PRODUCT_NAME}
            </Link>
            {" · "}Tournament
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl">
            {displayTournamentName(state)}
          </h1>
          <p className="text-[var(--muted)]">
            {displayDivision(state)}
            {state.format === "singles" ? " · Singles" : " · Doubles"}
            {event.categories.length > 1
              ? ` · ${event.categories.length} categories`
              : ""}
            {state.phase === "setup"
              ? state.format === "singles"
                ? " · Add players, then build brackets"
                : " · Add teams, then build brackets"
              : ` · ${event.courtCount} courts`}
          </p>
          <p className="max-w-xl text-sm text-[var(--muted)]">
            Scores save to your account. The scoreboard link is view-only. Give
            each umpire the QR code.
          </p>
          {bracketDates ? (
            <p className="text-sm font-medium text-amber-100">
              Tournament days {bracketDates}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link
              href={`/tournament/board/${publicToken}`}
              target="_blank"
              rel="noreferrer"
            >
              <Monitor className="h-4 w-4" aria-hidden />
              Scoreboard
            </Link>
          </Button>
          {umpireToken ? (
            <Button
              type="button"
              variant="outline"
              aria-expanded={showUmpire}
              onClick={() => {
                setUmpireUrl(
                  `${window.location.origin}/tournament/umpire/${umpireToken}`,
                );
                setShowUmpire((open) => !open);
              }}
            >
              <QrCode className="h-4 w-4" aria-hidden />
              Umpire QR
            </Button>
          ) : (
            <p className="max-w-xs self-center text-sm text-[var(--muted)]">
              Apply the latest database migration to turn on the umpire QR.
            </p>
          )}
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              <LayoutDashboard className="h-4 w-4" aria-hidden />
              Dashboard
            </Link>
          </Button>
        </div>
      </header>

      {showUmpire && umpireUrl ? (
        <section className="flex flex-wrap items-center gap-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <SessionQr url={umpireUrl} alt="Umpire QR code" />
          <div className="max-w-md space-y-2">
            <h2 className="font-[family-name:var(--font-display)] text-2xl">
              Umpire phone
            </h2>
            <p className="text-sm text-[var(--muted)]">
              Have the umpire scan this. That phone can enter the score for the
              court it is calling. Anyone with the scoreboard link can only
              watch.
            </p>
            <p
              className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100"
              role="note"
            >
              <span className="font-medium">Important.</span> Only one umpire
              phone can call a court. To switch umpires, that phone has to leave
              the court it is calling before the next umpire can take over.
            </p>
            <p className="break-all text-xs text-[var(--muted)]">{umpireUrl}</p>
          </div>
        </section>
      ) : null}

      {error ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Director views"
      >
        <Button
          type="button"
          variant={desk === "tournament" ? "default" : "outline"}
          aria-pressed={desk === "tournament"}
          onClick={() => setDesk("tournament")}
        >
          Tournament
        </Button>
        <Button
          type="button"
          variant={desk === "sponsors" ? "default" : "outline"}
          aria-pressed={desk === "sponsors"}
          onClick={() => setDesk("sponsors")}
        >
          Sponsors
          {event.sponsors.length > 0 ? (
            <span className="tabular-nums">{event.sponsors.length}</span>
          ) : null}
        </Button>
      </div>

      {desk === "sponsors" ? (
        <SponsorLogos
          tournamentId={tournamentId}
          event={event}
          onSave={commit}
          onError={setError}
        />
      ) : (
        <TournamentPanels
          event={event}
          bracketsOpen={bracketsOpen}
          bracketNotice={bracketNotice}
          state={state}
          view={view}
          filter={filter}
          confirmRemove={confirmRemove}
          champion={champion}
          run={run}
          runEvent={runEvent}
          report={report}
          clear={clear}
          setPicked={setPicked}
          setFilter={setFilter}
          setConfirmRemove={setConfirmRemove}
          undoOpen={undoOpen}
          setUndoOpen={setUndoOpen}
        />
      )}
    </main>
  );
}

function TournamentPanels({
  event,
  bracketsOpen,
  bracketNotice,
  state,
  view,
  filter,
  confirmRemove,
  champion,
  run,
  runEvent,
  report,
  clear,
  setPicked,
  setFilter,
  setConfirmRemove,
  undoOpen,
  setUndoOpen,
}: {
  event: TournamentEvent;
  bracketsOpen: boolean;
  bracketNotice: string;
  state: TournamentState;
  view: LiveView;
  filter: MatchFilter;
  confirmRemove: boolean;
  champion: ReturnType<typeof bracketChampion>;
  run: (action: () => TournamentState) => boolean;
  runEvent: (action: () => TournamentEvent) => boolean;
  report: (matchId: string, games: GameScore[]) => void;
  clear: (matchId: string) => void;
  setPicked: (picked: LiveView | null) => void;
  setFilter: (filter: MatchFilter) => void;
  setConfirmRemove: (confirm: boolean) => void;
  undoOpen: boolean;
  setUndoOpen: (open: boolean) => void;
}) {
  const [swapSelectedId, setSwapSelectedId] = useState<string | null>(null);
  const [swapTargetId, setSwapTargetId] = useState<string | null>(null);

  function clearSwapSelection() {
    setSwapSelectedId(null);
    setSwapTargetId(null);
  }

  function handleSwapSelect(matchId: string) {
    if (swapSelectedId == null) {
      setSwapSelectedId(matchId);
      return;
    }
    if (swapSelectedId === matchId) {
      clearSwapSelection();
      return;
    }
    setSwapTargetId(matchId);
  }

  function handleUnpark(matchId: string) {
    run(() => unparkMatch(state, matchId));
  }

  function handleRenameTeam(teamId: string, playerA: string, playerB?: string) {
    return run(() => renameTeam(state, teamId, playerA, playerB ?? ""));
  }

  const swapFrom =
    swapSelectedId != null
      ? state.matches.find((match) => match.id === swapSelectedId)
      : undefined;
  const swapTo =
    swapTargetId != null
      ? state.matches.find((match) => match.id === swapTargetId)
      : undefined;
  const upNextIds = new Set(
    upcomingMatches(event).map((slot) => slot.match.id),
  );

  return (
    <>
      <CategoryBar
        event={event}
        confirmRemove={confirmRemove}
        onSelect={(categoryId) => {
          setPicked(null);
          clearSwapSelection();
          runEvent(() => selectCategory(event, categoryId));
        }}
        onAdd={(name) => runEvent(() => addCategory(event, name))}
        onRemove={() => {
          if (confirmRemove) runEvent(() => removeCategory(event, state.id));
          else setConfirmRemove(true);
        }}
        onCancelRemove={() => setConfirmRemove(false)}
      />

      {champion ? (
        <p className="flex items-center gap-2 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 font-medium text-[var(--accent-fg-soft)]">
          <Trophy className="h-4 w-4 shrink-0" aria-hidden />
          {champion.name} won {displayDivision(state)}
        </p>
      ) : null}

      <CategoryCourts state={state} run={run} />

      {state.phase === "setup" ? (
        <SetupForm
          state={state}
          bracketsOpen={bracketsOpen}
          bracketNotice={bracketNotice}
          clubs={event.clubs}
          run={run}
          onAddClub={(name) => runEvent(() => addClub(event, name))}
          onRemoveClub={(name) => runEvent(() => removeClub(event, name))}
        />
      ) : (
        <div className="space-y-6">
          {canUndoDraw(state) ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3">
              <p className="text-sm text-amber-100">
                No scores yet — you can still undo{" "}
                {state.phase === "bracket" ? "the final" : "these brackets"} to
                change courts or the setup.
              </p>
              <Button
                type="button"
                size="sm"
                className="border-amber-300/50 bg-amber-300/15 text-amber-50 hover:bg-amber-300/25"
                variant="outline"
                onClick={() => setUndoOpen(true)}
              >
                {state.phase === "bracket" ? "Undo final" : "Undo brackets"}
              </Button>
            </div>
          ) : null}
          <Tabs
            value={view}
            onValueChange={(value) => {
              if (
                value === "settings" ||
                value === "bracket" ||
                value === "groups"
              ) {
                setPicked(value);
              }
            }}
          >
            <TabsList aria-label="Tournament stages">
              <TabsTrigger value="groups">
                Brackets
                <Progress state={state} stage="groups" />
              </TabsTrigger>
              <TabsTrigger value="bracket" disabled={state.phase !== "bracket"}>
                Finals
                {state.phase === "bracket" ? (
                  <Progress state={state} stage="bracket" />
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="settings">Category Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="groups" className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <StageToolbar filter={filter} onFilter={setFilter} />
              </div>
              {swapSelectedId ? (
                <p className="text-sm text-[var(--muted)]">
                  Tap Swap with this on another match, then confirm the preview.
                  Tap Cancel swap to abort.
                </p>
              ) : (
                <p className="text-sm text-[var(--muted)]">
                  Use Swap when a player would get consecutive games — pull a
                  match off court or reorder who is up next. Fix name typos in
                  Category Settings.
                </p>
              )}
              <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                <MatchColumn
                  state={state}
                  stage="groups"
                  filter={filter}
                  onReport={report}
                  onClear={clear}
                  swapSelectedId={swapSelectedId}
                  onSwapSelect={handleSwapSelect}
                  onUnpark={handleUnpark}
                  upNextIds={upNextIds}
                />
                <StandingsColumn
                  state={state}
                  lockedReason={bracketsOpen ? null : bracketNotice}
                  onBuild={() => {
                    if (!bracketsOpen) return;
                    if (run(() => generateBracket(state))) setPicked(null);
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="bracket" className="space-y-6">
              <p className="max-w-2xl text-sm text-[var(--muted)]">
                Winners move forward. Third place can be played as soon as the
                semifinals are done. Changing a score pulls that team back out
                of the next round. Use Swap to interchange courts or queue
                order. Fix name typos in Category Settings.
              </p>
              <BracketBoard
                state={state}
                onReport={report}
                onClear={clear}
                swapSelectedId={swapSelectedId}
                onSwapSelect={handleSwapSelect}
                onUnpark={handleUnpark}
                upNextIds={upNextIds}
              />
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              <CategorySettingsPanel
                state={state}
                run={run}
                onRenameTeam={handleRenameTeam}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
      <SwapConfirmDialog
        open={Boolean(swapFrom && swapTo)}
        state={state}
        from={swapFrom}
        to={swapTo}
        upNextIds={upNextIds}
        onOpenChange={(open) => {
          if (!open) setSwapTargetId(null);
        }}
        onConfirm={() => {
          if (!swapSelectedId || !swapTargetId) return;
          const swapped = run(() =>
            swapMatches(state, swapSelectedId, swapTargetId),
          );
          clearSwapSelection();
          if (!swapped) return;
        }}
      />
      <UndoBracketDialog
        open={undoOpen}
        phase={state.phase}
        onOpenChange={setUndoOpen}
        onConfirm={() => {
          const undone = run(() => undoUnscoredDraw(state));
          if (!undone) return;
          setPicked(null);
          setUndoOpen(false);
        }}
      />
    </>
  );
}

function UndoBracketDialog({
  open,
  phase,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  phase: TournamentState["phase"];
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const final = phase === "bracket";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {final ? "Undo the final bracket?" : "Undo these brackets?"}
          </DialogTitle>
          <DialogDescription>
            {final
              ? "No final score has been saved. The final and the third-place match are removed. Scores from these brackets stay, so you can change this category's courts and build the final again."
              : "No score has been saved. This category goes back to setup. Teams and its court choices stay, so you can change the courts and build the draw again."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm}>
            {final ? "Undo final" : "Undo brackets"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SwapConfirmDialog({
  open,
  state,
  from,
  to,
  upNextIds,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  state: TournamentState;
  from: TournamentMatch | undefined;
  to: TournamentMatch | undefined;
  upNextIds: ReadonlySet<string>;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  if (!from || !to) return null;

  const summary = swapResultSummary(from, to);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Swap these matches?</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <SwapMatchPreview state={state} match={from} upNextIds={upNextIds} />
          <p className="text-center text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            swaps with
          </p>
          <SwapMatchPreview state={state} match={to} upNextIds={upNextIds} />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm}>
            Confirm swap
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SwapMatchPreview({
  state,
  match,
  upNextIds,
}: {
  state: TournamentState;
  match: TournamentMatch;
  upNextIds: ReadonlySet<string>;
}) {
  const group = state.groups.find((item) => item.id === match.groupId);
  const label = group ? `M${match.number} – ${group.name}` : `M${match.number}`;
  const status = matchQueueStatus(match, upNextIds.has(match.id));
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        <span className={matchStatusBadgeClass(match, status)}>{status}</span>
      </div>
      <p className="truncate text-sm">{teamName(state, match.teamAId)}</p>
      <p className="truncate text-sm">{teamName(state, match.teamBId)}</p>
    </div>
  );
}

function matchStatusBadgeClass(match: TournamentMatch, status: string): string {
  if (match.courtNumber != null) {
    return "rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-medium text-[var(--accent-fg)]";
  }
  if (status === "Up next") {
    return "rounded-full bg-[var(--highlight)]/20 px-2 py-0.5 text-xs font-medium uppercase tracking-[0.14em] text-[var(--highlight)]";
  }
  return "text-xs uppercase tracking-[0.14em] text-[var(--muted)]";
}

function matchQueueStatus(match: TournamentMatch, upNext: boolean): string {
  if (match.courtNumber != null) return `Court ${match.courtNumber}`;
  if (match.parked) return "Parked";
  if (!match.teamAId || !match.teamBId) return "Waiting";
  if (upNext) return "Up next";
  return "In queue";
}

function swapResultSummary(from: TournamentMatch, to: TournamentMatch): string {
  const fromCourt = from.courtNumber;
  const toCourt = to.courtNumber;
  if (fromCourt != null && toCourt == null) {
    return `After the swap, ${matchLabel(to)} goes onto Court ${fromCourt}, and ${matchLabel(from)} returns to the queue.`;
  }
  if (fromCourt == null && toCourt != null) {
    return `After the swap, ${matchLabel(from)} goes onto Court ${toCourt}, and ${matchLabel(to)} returns to the queue.`;
  }
  if (fromCourt != null && toCourt != null) {
    return `These matches will swap courts: ${matchLabel(from)} moves to Court ${toCourt}, and ${matchLabel(to)} moves to Court ${fromCourt}.`;
  }
  const fromOrder =
    typeof from.queueOrder === "number" ? from.queueOrder : from.number;
  const toOrder = typeof to.queueOrder === "number" ? to.queueOrder : to.number;
  if (fromOrder <= toOrder) {
    return `These waiting matches will swap queue order. ${matchLabel(to)} will be ahead of ${matchLabel(from)}.`;
  }
  return `These waiting matches will swap queue order. ${matchLabel(from)} will be ahead of ${matchLabel(to)}.`;
}

function matchLabel(match: TournamentMatch): string {
  return `M${match.number}`;
}

function Progress({
  state,
  stage,
}: {
  state: TournamentState;
  stage: "groups" | "bracket";
}) {
  const progress = stageProgress(state, stage);
  return (
    <span className="tabular-nums text-[var(--muted)]">
      {progress.reported}/{progress.total}
    </span>
  );
}

function sponsorLabel(sponsor: TournamentSponsor): string {
  return sponsor.name.trim();
}

function SponsorLogos({
  tournamentId,
  event,
  onSave,
  onError,
}: {
  tournamentId: string;
  event: TournamentEvent;
  onSave: (next: TournamentEvent) => Promise<boolean>;
  onError: (message: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [tier, setTier] = useState<SponsorTier>("platinum");
  const [busy, setBusy] = useState(false);
  const full = event.sponsors.length >= MAX_SPONSOR_LOGOS;

  async function upload(submit: FormEvent) {
    submit.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      onError("Choose an image to upload.");
      return;
    }
    setBusy(true);
    onError(null);
    const uploaded = await uploadSponsorLogo(tournamentId, file);
    if (!uploaded.ok) {
      onError(uploaded.message);
      setBusy(false);
      return;
    }
    let next: TournamentEvent;
    try {
      next = addSponsor(event, {
        id: uploaded.id,
        name,
        url: uploaded.url,
        tier,
      });
    } catch (caught) {
      await deleteSponsorLogo(tournamentId, uploaded.url);
      onError(
        caught instanceof TournamentError
          ? caught.message
          : "Could not save the logo.",
      );
      setBusy(false);
      return;
    }
    const saved = await onSave(next);
    if (!saved) await deleteSponsorLogo(tournamentId, uploaded.url);
    if (saved) {
      setName("");
      if (fileRef.current) fileRef.current.value = "";
      onError(null);
    }
    setBusy(false);
  }

  async function remove(sponsor: TournamentSponsor) {
    setBusy(true);
    onError(null);
    let next: TournamentEvent;
    try {
      next = removeSponsor(event, sponsor.id);
    } catch (caught) {
      onError(
        caught instanceof TournamentError
          ? caught.message
          : "Could not remove the logo.",
      );
      setBusy(false);
      return;
    }
    const saved = await onSave(next);
    if (saved) await deleteSponsorLogo(tournamentId, sponsor.url);
    setBusy(false);
  }

  async function changeTier(sponsor: TournamentSponsor, nextTier: SponsorTier) {
    if (sponsor.tier === nextTier) return;
    setBusy(true);
    onError(null);
    let next: TournamentEvent;
    try {
      next = setSponsorTier(event, sponsor.id, nextTier);
    } catch (caught) {
      onError(
        caught instanceof TournamentError
          ? caught.message
          : "Could not update the logo.",
      );
      setBusy(false);
      return;
    }
    await onSave(next);
    setBusy(false);
  }

  return (
    <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="space-y-1">
        <h2 className="text-sm font-medium">Sponsors</h2>
        <p className="text-sm text-[var(--muted)]">
          Logos scroll in a bar along the bottom of the scoreboard. Platinum
          leads and nickel follows. PNG, JPEG, or WebP, up to 2 MB.
        </p>
      </div>
      <form className="flex flex-wrap items-end gap-2" onSubmit={upload}>
        <div className="min-w-[12rem] flex-1 space-y-1">
          <Label htmlFor="sponsor-logo">Logo</Label>
          <Input
            ref={fileRef}
            id="sponsor-logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy || full}
          />
        </div>
        <div className="min-w-[10rem] flex-1 space-y-1">
          <Label htmlFor="sponsor-name">Name</Label>
          <Input
            id="sponsor-name"
            value={name}
            onChange={(change) => setName(change.target.value)}
            placeholder="Ace Paddles"
            disabled={busy || full}
          />
        </div>
        <div className="min-w-[8rem] space-y-1">
          <Label htmlFor="sponsor-tier">Level</Label>
          <select
            id="sponsor-tier"
            value={tier}
            disabled={busy || full}
            onChange={(change) => {
              const next = change.target.value;
              if (isSponsorTier(next)) setTier(next);
            }}
            className="h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            {SPONSOR_TIERS.map((level) => (
              <option key={level} value={level}>
                {SPONSOR_TIER_LABELS[level]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={busy || full}>
          {busy ? "Saving…" : "Upload logo"}
        </Button>
      </form>
      {full ? (
        <p className="text-sm text-[var(--muted)]">
          This tournament already has {MAX_SPONSOR_LOGOS} sponsor logos.
        </p>
      ) : null}
      {event.sponsors.length > 0 ? (
        <div className="space-y-5">
          {SPONSOR_TIERS.map((level) => {
            const logos = event.sponsors
              .filter((sponsor) => sponsor.tier === level)
              .slice()
              .sort((a, b) => {
                const left = sponsorLabel(a);
                const right = sponsorLabel(b);
                if (!left && right) return 1;
                if (left && !right) return -1;
                return left.localeCompare(right);
              });
            if (logos.length === 0) return null;
            return (
              <div key={level} className="space-y-2">
                <h3 className="text-sm font-medium">
                  {SPONSOR_TIER_LABELS[level]}
                  <span className="ml-2 tabular-nums text-[var(--muted)]">
                    {logos.length}
                  </span>
                </h3>
                <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                  {logos.map((sponsor) => (
                    <li
                      key={sponsor.id}
                      className="grid grid-cols-[4.5rem_minmax(0,1fr)_8.5rem_4.5rem] items-center gap-3 px-3 py-2"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sponsor.url}
                        alt=""
                        className="h-10 w-[4.5rem] object-contain object-left"
                      />
                      <p className="truncate text-sm">
                        {sponsorLabel(sponsor) || (
                          <span className="text-[var(--muted)]">No name</span>
                        )}
                      </p>
                      <div>
                        <label
                          className="sr-only"
                          htmlFor={`sponsor-tier-${sponsor.id}`}
                        >
                          Level for {sponsorLabel(sponsor) || "sponsor"}
                        </label>
                        <select
                          id={`sponsor-tier-${sponsor.id}`}
                          value={sponsor.tier}
                          disabled={busy}
                          onChange={(change) => {
                            const next = change.target.value;
                            if (isSponsorTier(next))
                              void changeTier(sponsor, next);
                          }}
                          className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                        >
                          {SPONSOR_TIERS.map((option) => (
                            <option key={option} value={option}>
                              {SPONSOR_TIER_LABELS[option]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        className="text-right text-sm text-[var(--muted)] underline"
                        aria-label={`Remove ${sponsorLabel(sponsor) || "sponsor"} logo`}
                        disabled={busy}
                        onClick={() => void remove(sponsor)}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">No sponsor logos yet.</p>
      )}
    </section>
  );
}

function CategoryBar({
  event,
  confirmRemove,
  onSelect,
  onAdd,
  onRemove,
  onCancelRemove,
}: {
  event: TournamentEvent;
  confirmRemove: boolean;
  onSelect: (categoryId: string) => void;
  onAdd: (name: string) => boolean;
  onRemove: () => void;
  onCancelRemove: () => void;
}) {
  const [name, setName] = useState("");

  return (
    <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Categories</h2>
        <p className="text-sm text-[var(--muted)]">
          They play at the same time and share the courts.
        </p>
      </div>
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Categories"
      >
        {event.categories.map((category) => {
          const selected = category.id === event.activeCategoryId;
          return (
            <Button
              key={category.id}
              type="button"
              size="sm"
              variant={selected ? "default" : "outline"}
              aria-pressed={selected}
              onClick={() => onSelect(category.id)}
            >
              {displayDivision(category)}
            </Button>
          );
        })}
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(submit) => {
          submit.preventDefault();
          if (!onAdd(name)) return;
          setName("");
        }}
      >
        <div className="min-w-[12rem] flex-1 space-y-1">
          <Label htmlFor="new-category">New category</Label>
          <Input
            id="new-category"
            value={name}
            onChange={(change) => setName(change.target.value)}
            placeholder="Womens Open"
          />
        </div>
        <Button type="submit">Add category</Button>
        {event.categories.length > 1 ? (
          <Button type="button" variant="ghost" onClick={onRemove}>
            {confirmRemove ? "Remove this category" : "Remove category"}
          </Button>
        ) : null}
        {confirmRemove ? (
          <Button type="button" variant="ghost" onClick={onCancelRemove}>
            Cancel
          </Button>
        ) : null}
      </form>
    </section>
  );
}

function CategorySettingsPanel({
  state,
  run,
  onRenameTeam,
}: {
  state: TournamentState;
  run: (action: () => TournamentState) => boolean;
  onRenameTeam: (teamId: string, playerA: string, playerB?: string) => boolean;
}) {
  const singles = state.format === "singles";
  const sortedTeams = state.teams
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <section className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="space-y-1">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">
            Category
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Update names and scoring for this category. Draw shape stays locked
            while matches are live.
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="live-tournament-name">Tournament</Label>
          <Input
            id="live-tournament-name"
            value={state.name}
            onChange={(event) =>
              run(() =>
                updateTournamentDetails(state, { name: event.target.value }),
              )
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="live-division-name">Category</Label>
          <Input
            id="live-division-name"
            value={state.division}
            onChange={(event) =>
              run(() =>
                updateTournamentDetails(state, {
                  division: event.target.value,
                }),
              )
            }
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberSetting
            id="live-settings-points-to-quarters"
            label="Play to (groups & quarters)"
            min={1}
            max={99}
            value={state.pointsToQuarters}
            onChange={(pointsToQuarters) =>
              run(() => setDrawSettings(state, { pointsToQuarters }))
            }
          />
          <NumberSetting
            id="live-settings-points-semis-final"
            label="Play to (semis & final)"
            min={1}
            max={99}
            value={state.pointsSemisFinal}
            onChange={(pointsSemisFinal) =>
              run(() => setDrawSettings(state, { pointsSemisFinal }))
            }
          />
        </div>

        <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Draw format</h3>
            <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
              Locked while live
            </span>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--muted)]">Format</dt>
              <dd className="font-medium">{singles ? "Singles" : "Doubles"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Games per match</dt>
              <dd className="font-medium">{state.gamesPerMatch}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Brackets</dt>
              <dd className="font-medium">{state.bracketCount}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">
                {singles ? "Players" : "Teams"} per bracket
              </dt>
              <dd className="font-medium">{state.teamsPerBracket}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Advance per bracket</dt>
              <dd className="font-medium">{state.advancePerGroup}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Open spots</dt>
              <dd className="font-medium">
                {state.knockoutFill === "wildcard" ? "Wild card" : "Bye"}
              </dd>
            </div>
          </dl>
          <p className="text-sm text-[var(--muted)]">
            Use the undo banner above while there are no scores if you need to
            change format, brackets, or open spots.
          </p>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <h2 className="font-[family-name:var(--font-display)] text-2xl">
              {singles ? "Players" : "Teams"}
            </h2>
            <p className="text-sm text-[var(--muted)]">
              Fix typos without rebuilding the draw. Matches and standings keep
              the same entries.
            </p>
          </div>
          <span className="text-sm tabular-nums text-[var(--muted)]">
            {state.teams.length}
          </span>
        </div>
        {sortedTeams.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-sm text-[var(--muted)]">
            No {singles ? "players" : "teams"} in this category.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
            {sortedTeams.map((team, index) => {
              const group =
                team.bracketIndex != null
                  ? bracketName(team.bracketIndex)
                  : null;
              return (
                <li
                  key={team.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                      {index + 1}
                      {group ? ` · ${group}` : ""}
                      {team.club ? ` · ${team.club}` : ""}
                    </p>
                    <SettingsTeamEditor
                      team={team}
                      format={state.format}
                      onRename={onRenameTeam}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function SettingsTeamEditor({
  team,
  format,
  onRename,
}: {
  team: TournamentState["teams"][number];
  format: TournamentState["format"];
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

  function save() {
    const ok =
      format === "singles"
        ? onRename(team.id, playerA)
        : onRename(team.id, playerA, playerB);
    if (ok) setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="truncate font-medium">{team.name}</p>
        <Button type="button" size="sm" variant="outline" onClick={startEdit}>
          Edit name
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Input
        aria-label={format === "singles" ? "Player name" : "Player 1"}
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
            setEditing(false);
          }
        }}
        className="h-9 min-w-0 flex-1"
      />
      {format === "doubles" ? (
        <>
          <span className="text-sm text-[var(--muted)]">/</span>
          <Input
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
                setEditing(false);
              }
            }}
            className="h-9 min-w-0 flex-1"
          />
        </>
      ) : null}
      <Button type="button" size="sm" onClick={save}>
        Save
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setEditing(false)}
      >
        Cancel
      </Button>
    </div>
  );
}

function CategoryCourts({
  state,
  run,
}: {
  state: TournamentState;
  run: (action: () => TournamentState) => boolean;
}) {
  const selected =
    state.courtNumbers.length === 0
      ? Array.from({ length: state.courtCount }, (_, index) => index + 1)
      : state.courtNumbers;
  const division = displayDivision(state);

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
        <div className="space-y-1">
          <h2 className="text-sm font-medium">Courts used for {division}</h2>
          <p className="max-w-xl text-sm text-[var(--muted)]">
            Tap courts this category can use. Venue courts come from Settings —
            leave at least one on.
          </p>
        </div>
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          {selected.length} of {state.courtCount} selected
        </p>
      </div>
      <div
        className="grid gap-3 p-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        role="group"
        aria-label={`Courts used for ${division}`}
      >
        {Array.from({ length: state.courtCount }, (_, index) => {
          const number = index + 1;
          const checked = selected.includes(number);
          return (
            <button
              key={number}
              type="button"
              aria-pressed={checked}
              onClick={() => {
                const next = checked
                  ? selected.filter((court) => court !== number)
                  : [...selected, number];
                run(() => setCategoryCourts(state, next));
              }}
              className={
                checked
                  ? "flex items-center justify-between gap-3 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-left transition-colors hover:bg-[var(--accent)]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  : "flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-left text-[var(--muted)] transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--surface-3)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              }
            >
              <span className="space-y-0.5">
                <span className="block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                  Court
                </span>
                <span
                  className={
                    checked
                      ? "block text-lg font-semibold text-[var(--accent-fg-soft)]"
                      : "block text-lg font-semibold"
                  }
                >
                  {number}
                </span>
              </span>
              <span
                className={
                  checked
                    ? "flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-fg)]"
                    : "flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)]"
                }
                aria-hidden
              >
                {checked ? <Check className="h-4 w-4" /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SetupForm({
  state,
  bracketsOpen,
  bracketNotice,
  clubs,
  run,
  onAddClub,
  onRemoveClub,
}: {
  state: TournamentState;
  bracketsOpen: boolean;
  bracketNotice: string;
  clubs: string[];
  run: (action: () => TournamentState) => boolean;
  onAddClub: (name: string) => boolean;
  onRemoveClub: (name: string) => boolean;
}) {
  const [playerA, setPlayerA] = useState("");
  const [playerB, setPlayerB] = useState("");
  const [clubName, setClubName] = useState("");
  const singles = state.format === "singles";
  const entryNoun = singles ? "players" : "teams";
  let planMessage = "";
  let planReady = false;
  if (state.teams.length >= 2) {
    try {
      const sizes = planBracketSizes(
        state.teams.length,
        state.bracketCount,
        state.teamsPerBracket,
      );
      planReady = true;
      const noun = state.bracketCount === 1 ? "bracket" : "brackets";
      planMessage = sizes.every((size) => size === sizes[0])
        ? `${state.bracketCount} ${noun} of ${sizes[0]}.`
        : `${state.bracketCount} brackets: ${sizes.join(", ")} ${entryNoun}.`;
    } catch (caught) {
      planMessage = caught instanceof TournamentError ? caught.message : "";
    }
  }
  const usingAssignments = state.teams.some(
    (team) => team.bracketIndex != null,
  );
  const assignmentIssue = bracketAssignmentIssue(state);
  const canBuild =
    bracketsOpen &&
    state.teams.length >= 2 &&
    (usingAssignments ? assignmentIssue == null : planReady);
  const buildMessage = !bracketsOpen
    ? bracketNotice
    : state.teams.length < 2
      ? `Add at least 2 ${entryNoun} to build brackets.`
      : usingAssignments
        ? (assignmentIssue ?? "Using the brackets you assigned.")
        : planMessage;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="space-y-1">
          <Label htmlFor="tournament-name">Tournament</Label>
          <Input
            id="tournament-name"
            value={state.name}
            onChange={(event) =>
              run(() =>
                updateTournamentDetails(state, { name: event.target.value }),
              )
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="division-name">Category</Label>
          <Input
            id="division-name"
            value={state.division}
            onChange={(event) =>
              run(() =>
                updateTournamentDetails(state, {
                  division: event.target.value,
                }),
              )
            }
          />
        </div>
        <div className="space-y-2">
          <p
            id="category-format-label"
            className="text-sm font-medium leading-none text-[var(--foreground)]"
          >
            Format
          </p>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-labelledby="category-format-label"
          >
            {(
              [
                ["doubles", "Doubles"],
                ["singles", "Singles"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={state.format === value ? "default" : "outline"}
                aria-pressed={state.format === value}
                onClick={() => run(() => setCategoryFormat(state, value))}
              >
                {label}
              </Button>
            ))}
          </div>
          <p className="text-sm text-[var(--muted)]">
            {singles
              ? "One player a side. Clear the list before switching back to doubles."
              : "Two players a side. Clear the list before switching to singles."}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberSetting
            id="games-per-match"
            label="Games per match"
            min={1}
            max={3}
            value={state.gamesPerMatch}
            onChange={(gamesPerMatch) =>
              run(() => setDrawSettings(state, { gamesPerMatch }))
            }
          />
          <NumberSetting
            id="points-to-quarters"
            label="Play to (groups & quarters)"
            min={1}
            max={99}
            value={state.pointsToQuarters}
            onChange={(pointsToQuarters) =>
              run(() => setDrawSettings(state, { pointsToQuarters }))
            }
          />
          <NumberSetting
            id="points-semis-final"
            label="Play to (semis & final)"
            min={1}
            max={99}
            value={state.pointsSemisFinal}
            onChange={(pointsSemisFinal) =>
              run(() => setDrawSettings(state, { pointsSemisFinal }))
            }
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberSetting
            id="bracket-count"
            label="Brackets"
            min={1}
            max={16}
            value={state.bracketCount}
            onChange={(bracketCount) =>
              run(() => setDrawSettings(state, { bracketCount }))
            }
          />
          <NumberSetting
            id="teams-per-bracket"
            label={singles ? "Players per bracket" : "Teams per bracket"}
            min={2}
            max={8}
            value={state.teamsPerBracket}
            onChange={(teamsPerBracket) =>
              run(() => setDrawSettings(state, { teamsPerBracket }))
            }
          />
          <NumberSetting
            id="advance-per-bracket"
            label="Advance per bracket"
            min={1}
            max={state.teamsPerBracket}
            value={state.advancePerGroup}
            onChange={(advancePerGroup) =>
              run(() => setDrawSettings(state, { advancePerGroup }))
            }
          />
          <div className="space-y-2 sm:col-span-3">
            <p
              id="open-spots-label"
              className="text-sm font-medium leading-none text-[var(--foreground)]"
            >
              Open spots
            </p>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-labelledby="open-spots-label"
            >
              {(
                [
                  ["bye", "Bye"],
                  ["wildcard", "Wild card"],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={state.knockoutFill === value ? "default" : "outline"}
                  aria-pressed={state.knockoutFill === value}
                  onClick={() =>
                    run(() => setDrawSettings(state, { knockoutFill: value }))
                  }
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <p className="text-sm text-[var(--muted)]">
          {singles ? "Players" : "Teams"} per bracket is the round-robin group,
          not the final. Advance per bracket is how many from each one move into
          a separate final bracket. When those moving on do not fill the final
          bracket, Bye leaves the open spots empty and Wild card fills them with
          the next-best, ranked by wins, then point differential, then points
          scored. Games per match is how many scores you enter. Groups and every
          round through the quarterfinals play to the first point total.
          Semifinals and the final play to the second.
        </p>
      </section>

      <section className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">
            {singles ? "Players" : "Teams"}
          </h2>
          <span className="text-sm tabular-nums text-[var(--muted)]">
            {state.teams.length}
          </span>
        </div>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const added = run(() =>
              singles
                ? addTeam(state, playerA)
                : addTeam(state, playerA, playerB),
            );
            if (!added) return;
            setPlayerA("");
            setPlayerB("");
          }}
        >
          <div className="min-w-[8rem] flex-1 space-y-1">
            <Label htmlFor="player-a">{singles ? "Player" : "Player 1"}</Label>
            <Input
              id="player-a"
              value={playerA}
              onChange={(event) => setPlayerA(event.target.value)}
              placeholder="Smith"
            />
          </div>
          {singles ? null : (
            <div className="min-w-[8rem] flex-1 space-y-1">
              <Label htmlFor="player-b">Player 2</Label>
              <Input
                id="player-b"
                value={playerB}
                onChange={(event) => setPlayerB(event.target.value)}
                placeholder="Crozier"
              />
            </div>
          )}
          <Button type="submit">{singles ? "Add player" : "Add team"}</Button>
        </form>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(submit) => {
            submit.preventDefault();
            if (!onAddClub(clubName)) return;
            setClubName("");
          }}
        >
          <div className="min-w-[8rem] flex-1 space-y-1">
            <Label htmlFor="club-name">Club</Label>
            <Input
              id="club-name"
              value={clubName}
              onChange={(event) => setClubName(event.target.value)}
              placeholder="Haraya"
            />
          </div>
          <Button type="submit" variant="secondary">
            Add club
          </Button>
        </form>
        {clubs.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {clubs.map((club) => (
              <li
                key={club}
                className="flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1 text-sm"
              >
                {club}
                <button
                  type="button"
                  className="text-[var(--muted)] underline"
                  aria-label={`Remove ${club}`}
                  onClick={() => onRemoveClub(club)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-sm text-[var(--muted)]">
          Add each club once, then pick it on the {singles ? "player" : "team"}.
          The scoreboard totals match wins for that club across every category.
        </p>
        {state.teams.length === 0 ? (
          <Button
            variant="secondary"
            onClick={() => run(() => addSampleTeams(state))}
          >
            {singles ? "Use 8 sample players" : "Use 8 sample teams"}
          </Button>
        ) : (
          <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
            {state.teams.map((team, index) => (
              <li
                key={team.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1">
                  <span className="mr-2 tabular-nums text-[var(--muted)]">
                    {index + 1}
                  </span>
                  {team.name}
                </span>
                <div className="flex items-center gap-2">
                  <label className="sr-only" htmlFor={`bracket-${team.id}`}>
                    Bracket for {team.name}
                  </label>
                  <select
                    id={`bracket-${team.id}`}
                    value={
                      team.bracketIndex == null ? "" : String(team.bracketIndex)
                    }
                    onChange={(event) => {
                      const raw = event.target.value;
                      run(() =>
                        assignTeamBracket(
                          state,
                          team.id,
                          raw === "" ? null : Number.parseInt(raw, 10),
                        ),
                      );
                    }}
                    className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    <option value="">Unassigned</option>
                    {Array.from({ length: state.bracketCount }, (_, slot) => (
                      <option key={slot} value={slot}>
                        {bracketName(slot)}
                      </option>
                    ))}
                  </select>
                  <label className="sr-only" htmlFor={`club-${team.id}`}>
                    Club for {team.name}
                  </label>
                  <select
                    id={`club-${team.id}`}
                    value={team.club ?? ""}
                    onChange={(event) => {
                      const raw = event.target.value;
                      run(() =>
                        assignTeamClub(
                          state,
                          team.id,
                          raw === "" ? null : raw,
                          clubs,
                        ),
                      );
                    }}
                    className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    <option value="">No club</option>
                    {clubs.map((club) => (
                      <option key={club} value={club}>
                        {club}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => run(() => removeTeam(state, team.id))}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {state.teams.length > 0 ? (
          <p className="text-sm text-[var(--muted)]">
            {Array.from({ length: state.bracketCount }, (_, slot) => {
              const count = state.teams.filter(
                (team) => team.bracketIndex === slot,
              ).length;
              return `${bracketName(slot)} ${count}/${state.teamsPerBracket}`;
            }).join(" · ")}
          </p>
        ) : null}
        {!bracketsOpen ? (
          <p
            className="flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100"
            role="status"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {bracketNotice}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!canBuild}
            onClick={() => run(() => generateGroups(state))}
          >
            Build brackets
          </Button>
          <Button
            variant="outline"
            disabled={!planReady}
            onClick={() => run(() => autoAssignBrackets(state))}
          >
            Auto-fill brackets
          </Button>
        </div>
        {bracketsOpen || state.teams.length > 0 ? (
          <p className="text-sm text-[var(--muted)]">
            {[
              bracketsOpen ? buildMessage : "",
              state.teams.length > 0
                ? singles
                  ? "Pick a bracket for each player, or auto-fill, then build."
                  : "Pick a bracket for each team, or auto-fill, then build."
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function NumberSetting({
  id,
  label,
  min,
  max,
  value,
  onChange,
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => {
          const parsed = Number.parseInt(event.target.value, 10);
          if (!Number.isInteger(parsed)) return;
          onChange(parsed);
        }}
      />
    </div>
  );
}

function StageToolbar({
  filter,
  onFilter,
}: {
  filter: MatchFilter;
  onFilter: (filter: MatchFilter) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(
        [
          ["unreported", "Unreported"],
          ["reported", "Reported"],
          ["court", "On court"],
          ["all", "All matches"],
        ] as const
      ).map(([value, label]) => (
        <Button
          key={value}
          type="button"
          size="sm"
          variant={filter === value ? "default" : "outline"}
          aria-pressed={filter === value}
          onClick={() => onFilter(value)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

function MatchColumn({
  state,
  stage,
  filter,
  onReport,
  onClear,
  swapSelectedId,
  onSwapSelect,
  onUnpark,
  upNextIds,
}: {
  state: TournamentState;
  stage: "groups" | "bracket";
  filter: MatchFilter;
  onReport: (matchId: string, games: GameScore[]) => void;
  onClear: (matchId: string) => void;
  swapSelectedId: string | null;
  onSwapSelect: (matchId: string) => void;
  onUnpark: (matchId: string) => void;
  upNextIds: ReadonlySet<string>;
}) {
  const matches = state.matches.filter((match) => {
    if (match.stage !== stage || match.status === "bye") return false;
    if (filter === "unreported") return match.status === "unreported";
    if (filter === "reported") return match.status === "reported";
    if (filter === "court") return match.courtNumber != null;
    return true;
  });
  const progress = stageProgress(state, stage);

  return (
    <div className="space-y-3">
      {matches.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-sm text-[var(--muted)]">
          {progress.total > 0 && progress.reported === progress.total
            ? "Every bracket match has a score."
            : "No matches in this filter."}
        </p>
      ) : (
        matches.map((match) => (
          <MatchCard
            key={match.id}
            state={state}
            match={match}
            groupName={
              state.groups.find((group) => group.id === match.groupId)?.name
            }
            onReport={onReport}
            onClear={onClear}
            swapSelectedId={swapSelectedId}
            onSwapSelect={onSwapSelect}
            onUnpark={onUnpark}
            upNext={upNextIds.has(match.id)}
          />
        ))
      )}
    </div>
  );
}

function StandingsColumn({
  state,
  lockedReason,
  onBuild,
}: {
  state: TournamentState;
  lockedReason: string | null;
  onBuild: () => void;
}) {
  const reason = lockedReason ?? bracketBlockReason(state);
  const wildcards = wildcardTeamIds(state);

  return (
    <div className="space-y-4">
      {state.groups.map((group) => (
        <StandingsTable
          key={group.id}
          title={group.name}
          rows={groupStandings(state, group.id)}
          advanceCount={Math.min(state.advancePerGroup, group.teamIds.length)}
          wildcardTeamIds={wildcards}
        />
      ))}
      <p className="text-sm text-[var(--muted)]">
        Highlighted teams advance to the final.
        {state.knockoutFill === "wildcard"
          ? " Wild card teams fill open spots and are ranked across brackets by wins, then point differential, then points scored."
          : ""}{" "}
        Order inside a bracket is wins, then head-to-head when two teams are
        tied, then point differential, then points scored.
      </p>
      {state.phase === "groups" ? (
        <div className="space-y-2">
          <Button type="button" disabled={Boolean(reason)} onClick={onBuild}>
            Build final bracket
          </Button>
          {reason ? (
            lockedReason ? (
              <p
                className="flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100"
                role="status"
              >
                <TriangleAlert
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden
                />
                {reason}
              </p>
            ) : (
              <p className="text-sm text-[var(--muted)]">{reason}</p>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function BracketBoard({
  state,
  onReport,
  onClear,
  swapSelectedId,
  onSwapSelect,
  onUnpark,
  upNextIds,
}: {
  state: TournamentState;
  onReport: (matchId: string, games: GameScore[]) => void;
  onClear: (matchId: string) => void;
  swapSelectedId: string | null;
  onSwapSelect: (matchId: string) => void;
  onUnpark: (matchId: string) => void;
  upNextIds: ReadonlySet<string>;
}) {
  const columns = bracketColumns(state);

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {columns.map((column) => (
        <div key={column.key} className="flex w-80 shrink-0 flex-col gap-3">
          {column.groups.map((group) => (
            <div key={group.label} className="flex flex-col gap-3">
              <h2 className="text-sm font-medium">{group.label}</h2>
              {group.matches.map((match) => (
                <MatchCard
                  key={match.id}
                  state={state}
                  match={match}
                  onReport={onReport}
                  onClear={onClear}
                  swapSelectedId={swapSelectedId}
                  onSwapSelect={onSwapSelect}
                  onUnpark={onUnpark}
                  upNext={upNextIds.has(match.id)}
                />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
