"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Monitor, QrCode, Trophy } from "lucide-react";
import {
  activeCategory,
  addCategory,
  addSampleTeams,
  addTeam,
  assignTeamBracket,
  autoAssignBrackets,
  bracketAssignmentIssue,
  bracketBlockReason,
  bracketName,
  bracketChampion,
  clearMatchScore,
  commitCategory,
  discardBracket,
  displayDivision,
  displayTournamentName,
  generateBracket,
  generateGroups,
  groupStandings,
  planBracketSizes,
  removeCategory,
  removeTeam,
  reportMatchScore,
  resetDraw,
  roundLabel,
  selectCategory,
  setDrawSettings,
  stageProgress,
  startOverEvent,
  TournamentError,
  updateTournamentDetails,
  type GameScore,
  type TournamentEvent,
  type TournamentState,
} from "@/engine/tournament";
import { MatchCard } from "@/components/tournament/match-card";
import { SessionQr } from "@/components/session/session-qr";
import { StandingsTable } from "@/components/tournament/standings-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { saveTournamentDocument } from "@/lib/tournament-client";
import {
  LEGACY_TOURNAMENT_STORAGE_KEY,
  readLegacyTournament,
  shouldAdoptLocalTournament,
  tournamentEventFromDocument,
} from "@/lib/tournament-document";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type MatchFilter = "unreported" | "court" | "all";

export function TournamentDirector({
  tournamentId,
  publicToken,
  umpireToken,
  initialEvent,
}: {
  tournamentId: string;
  publicToken: string;
  umpireToken: string;
  initialEvent: TournamentEvent;
}) {
  const [event, setEvent] = useState(initialEvent);
  const savedRef = useRef(initialEvent);
  const pendingRef = useRef(0);
  const saveSeq = useRef(0);
  const state = activeCategory(event);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<"groups" | "bracket" | null>(null);
  const [filter, setFilter] = useState<MatchFilter>("unreported");
  const [confirm, setConfirm] = useState<"edit" | "start" | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [showUmpire, setShowUmpire] = useState(false);
  const [umpireUrl, setUmpireUrl] = useState<string | null>(null);
  const view = state.phase === "bracket" ? (picked ?? "bracket") : "groups";

  const commit = useCallback(
    (next: TournamentEvent) => {
      setEvent(next);
      const seq = ++saveSeq.current;
      pendingRef.current += 1;
      void saveTournamentDocument(tournamentId, next).then((result) => {
        pendingRef.current = Math.max(0, pendingRef.current - 1);
        if (seq !== saveSeq.current) return;
        if (!result.ok) {
          setError(
            result.missingSchema
              ? "Run the latest database migration, then try again."
              : "Could not save the tournament. Check your connection and try again.",
          );
          setEvent(savedRef.current);
          return;
        }
        savedRef.current = next;
      });
    },
    [tournamentId],
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
          if (pendingRef.current > 0) return;
          const next = tournamentEventFromDocument(payload.new.document);
          if (!next) return;
          savedRef.current = next;
          setEvent(next);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  function runEvent(action: () => TournamentEvent): boolean {
    try {
      commit(action());
      setError(null);
      setConfirm(null);
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

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
            <Link href="/" className="hover:underline">
              OpenDinks
            </Link>
            {" · "}Tournament
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl">
            {displayTournamentName(state)}
          </h1>
          <p className="text-[var(--muted)]">
            {displayDivision(state)}
            {event.categories.length > 1
              ? ` · ${event.categories.length} categories`
              : ""}
            {state.phase === "setup"
              ? " · Add teams, then build brackets"
              : ` · ${event.courtCount} courts`}
          </p>
          <p className="max-w-xl text-sm text-[var(--muted)]">
            Scores save to your account. The scoreboard link is view-only. Give
            each umpire the QR code.
          </p>
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
            <Link href="/demo">Open play</Link>
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

      <CategoryBar
        event={event}
        confirmRemove={confirmRemove}
        onSelect={(categoryId) => {
          setPicked(null);
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

      {state.phase === "setup" ? (
        <SetupForm state={state} run={run} />
      ) : (
        <Tabs
          value={view}
          onValueChange={(value) =>
            setPicked(value === "bracket" ? "bracket" : "groups")
          }
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
          </TabsList>

          <TabsContent value="groups" className="space-y-6">
            <StageToolbar
              state={state}
              filter={filter}
              onFilter={setFilter}
              onCourts={(courtCount) =>
                run(() => updateTournamentDetails(state, { courtCount }))
              }
              onEdit={() => {
                if (confirm === "edit") run(() => resetDraw(state));
                else setConfirm("edit");
              }}
              onStart={() => {
                if (confirm === "start") runEvent(() => startOverEvent(event));
                else setConfirm("start");
              }}
              confirm={confirm}
              onCancelConfirm={() => setConfirm(null)}
            />
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <MatchColumn
                state={state}
                stage="groups"
                filter={filter}
                onReport={report}
                onClear={clear}
              />
              <StandingsColumn
                state={state}
                onBuild={() => {
                  if (run(() => generateBracket(state))) setPicked(null);
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="bracket" className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--muted)]">
                Winners move forward. Changing a score pulls that team back out
                of the next round.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPicked(null);
                  run(() => discardBracket(state));
                }}
              >
                Discard bracket
              </Button>
            </div>
            <BracketBoard state={state} onReport={report} onClear={clear} />
          </TabsContent>
        </Tabs>
      )}
    </main>
  );
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

function SetupForm({
  state,
  run,
}: {
  state: TournamentState;
  run: (action: () => TournamentState) => boolean;
}) {
  const [playerA, setPlayerA] = useState("");
  const [playerB, setPlayerB] = useState("");
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
        : `${state.bracketCount} brackets: ${sizes.join(", ")} teams.`;
    } catch (caught) {
      planMessage = caught instanceof TournamentError ? caught.message : "";
    }
  }
  const usingAssignments = state.teams.some(
    (team) => team.bracketIndex != null,
  );
  const assignmentIssue = bracketAssignmentIssue(state);
  const canBuild =
    state.teams.length >= 2 &&
    (usingAssignments ? assignmentIssue == null : planReady);
  const buildMessage =
    state.teams.length < 2
      ? "Add at least 2 teams to build brackets."
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="court-count">Courts</Label>
            <Input
              id="court-count"
              type="number"
              min={1}
              max={32}
              value={state.courtCount}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10);
                if (!Number.isInteger(parsed)) return;
                run(() =>
                  updateTournamentDetails(state, { courtCount: parsed }),
                );
              }}
            />
          </div>
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
            label="Teams per bracket"
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
        </div>
        <p className="text-sm text-[var(--muted)]">
          Teams per bracket is the round-robin group, not the final. Advance per
          bracket is how many teams from each one move into a separate final
          bracket. Games per match is how many scores you enter.
        </p>
      </section>

      <section className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">
            Teams
          </h2>
          <span className="text-sm tabular-nums text-[var(--muted)]">
            {state.teams.length}
          </span>
        </div>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const added = run(() => addTeam(state, playerA, playerB));
            if (!added) return;
            setPlayerA("");
            setPlayerB("");
          }}
        >
          <div className="min-w-[8rem] flex-1 space-y-1">
            <Label htmlFor="player-a">Player 1</Label>
            <Input
              id="player-a"
              value={playerA}
              onChange={(event) => setPlayerA(event.target.value)}
              placeholder="Smith"
            />
          </div>
          <div className="min-w-[8rem] flex-1 space-y-1">
            <Label htmlFor="player-b">Player 2</Label>
            <Input
              id="player-b"
              value={playerB}
              onChange={(event) => setPlayerB(event.target.value)}
              placeholder="Crozier"
            />
          </div>
          <Button type="submit">Add team</Button>
        </form>
        {state.teams.length === 0 ? (
          <Button
            variant="secondary"
            onClick={() => run(() => addSampleTeams(state))}
          >
            Use 8 sample teams
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
        <p className="text-sm text-[var(--muted)]">
          {buildMessage}
          {state.teams.length > 0
            ? " Pick a bracket for each team, or auto-fill, then build."
            : ""}
        </p>
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
  state,
  filter,
  onFilter,
  onCourts,
  onEdit,
  onStart,
  confirm,
  onCancelConfirm,
}: {
  state: TournamentState;
  filter: MatchFilter;
  onFilter: (filter: MatchFilter) => void;
  onCourts: (count: number) => void;
  onEdit: () => void;
  onStart: () => void;
  confirm: "edit" | "start" | null;
  onCancelConfirm: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(
        [
          ["unreported", "Unreported"],
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
      <label className="ml-auto flex items-center gap-2 text-sm text-[var(--muted)]">
        Courts
        <Input
          className="h-8 w-16"
          type="number"
          min={1}
          max={32}
          value={state.courtCount}
          aria-label="Courts in use"
          onChange={(event) => {
            const parsed = Number.parseInt(event.target.value, 10);
            if (!Number.isInteger(parsed)) return;
            onCourts(parsed);
          }}
        />
      </label>
      <Button type="button" size="sm" variant="outline" onClick={onEdit}>
        {confirm === "edit" ? "Discard scores and edit teams" : "Edit teams"}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onStart}>
        {confirm === "start" ? "Erase this tournament" : "Start over"}
      </Button>
      {confirm ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancelConfirm}
        >
          Cancel
        </Button>
      ) : null}
    </div>
  );
}

function MatchColumn({
  state,
  stage,
  filter,
  onReport,
  onClear,
}: {
  state: TournamentState;
  stage: "groups" | "bracket";
  filter: MatchFilter;
  onReport: (matchId: string, games: GameScore[]) => void;
  onClear: (matchId: string) => void;
}) {
  const matches = state.matches.filter((match) => {
    if (match.stage !== stage || match.status === "bye") return false;
    if (filter === "unreported") return match.status === "unreported";
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
          />
        ))
      )}
    </div>
  );
}

function StandingsColumn({
  state,
  onBuild,
}: {
  state: TournamentState;
  onBuild: () => void;
}) {
  const reason = bracketBlockReason(state);

  return (
    <div className="space-y-4">
      {state.groups.map((group) => (
        <StandingsTable
          key={group.id}
          title={group.name}
          rows={groupStandings(state, group.id)}
          advanceCount={Math.min(state.advancePerGroup, group.teamIds.length)}
        />
      ))}
      <p className="text-sm text-[var(--muted)]">
        Highlighted teams advance to the final. Order is wins, then head-to-head
        when two teams are tied, then point differential, then points scored.
      </p>
      {state.phase === "groups" ? (
        <div className="space-y-2">
          <Button type="button" disabled={Boolean(reason)} onClick={onBuild}>
            Build final bracket
          </Button>
          {reason ? (
            <p className="text-sm text-[var(--muted)]">{reason}</p>
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
}: {
  state: TournamentState;
  onReport: (matchId: string, games: GameScore[]) => void;
  onClear: (matchId: string) => void;
}) {
  const matches = state.matches.filter((match) => match.stage === "bracket");
  const rounds = [...new Set(matches.map((match) => match.round))].sort(
    (a, b) => a - b,
  );
  const lastRound = rounds[rounds.length - 1] ?? 1;

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {rounds.map((round) => {
        const inRound = matches
          .filter((match) => match.round === round)
          .sort((a, b) => a.slot - b.slot);
        return (
          <div
            key={round}
            className={cn(
              "flex w-80 shrink-0 flex-col gap-3",
              round === lastRound && "justify-center",
            )}
          >
            <h2 className="text-sm font-medium">
              {roundLabel(inRound.length, round, lastRound)}
            </h2>
            {inRound.map((match) => (
              <MatchCard
                key={match.id}
                state={state}
                match={match}
                onReport={onReport}
                onClear={onClear}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
