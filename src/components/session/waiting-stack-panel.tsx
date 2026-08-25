"use client";

import { useState } from "react";
import type { DragEvent } from "react";
import { GripVertical } from "lucide-react";
import type { EngineAction, EnginePlayer, EngineState } from "@/engine";
import { formatSkillTier } from "@/lib/skill-tier";
import {
  findSeparatedTeamLocks,
  formatSeparatedTeamLockMessage,
  formatTeamLockLabel,
  groupWaitingStack,
  orderedWaitingPlayers,
  reorderWaitingStackIds,
  playerName,
  playersPerCourt,
} from "@/engine";
import { tryStackPush } from "@/lib/stack-push";
import {
  formatPrepareAnnouncement,
  speakAnnouncement,
} from "@/lib/speech-announcer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function groupLabel(
  groupIndex: number,
  groupSize: number,
  count: number,
): string {
  if (groupIndex === 0 && count === groupSize) return "Next court";
  if (count === groupSize) return `On deck · group ${groupIndex + 1}`;
  return `Waiting · ${count}/${groupSize}`;
}

function SortablePlayerRow({
  player,
  stackIndex,
  state,
  dispatch,
  draggedId,
  dragOverId,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: {
  player: EnginePlayer;
  stackIndex: number;
  state: EngineState;
  dispatch: (action: EngineAction) => void;
  draggedId: string | null;
  dragOverId: string | null;
  onDragStart: (event: DragEvent, playerId: string) => void;
  onDragOver: (event: DragEvent, playerId: string) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent, playerId: string) => void;
  onDragEnd: () => void;
}) {
  const isDragging = draggedId === player.id;
  const isDragOver = dragOverId === player.id && draggedId !== player.id;

  return (
    <li
      onDragOver={(event) => onDragOver(event, player.id)}
      onDragLeave={onDragLeave}
      onDrop={(event) => onDrop(event, player.id)}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-[var(--surface)] px-3 py-2 transition-colors",
        isDragging && "opacity-45",
        isDragOver
          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
          : "border-[var(--border)]",
      )}
    >
      <button
        type="button"
        draggable
        onDragStart={(event) => onDragStart(event, player.id)}
        onDragEnd={onDragEnd}
        className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] active:cursor-grabbing"
        aria-label={`Drag to reorder ${player.name}`}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-semibold tabular-nums text-[var(--muted)]">
        {stackIndex + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{player.name}</div>
        <div className="text-xs text-[var(--muted)]">
          {formatSkillTier(player.skill)} · {player.gamesPlayed} games
          {player.partnerLockId
            ? ` · locked w/ ${playerName(state, player.partnerLockId)}`
            : ""}
          {player.teamLockGroupId
            ? ` · team ${formatTeamLockLabel(state, player.teamLockGroupId)}`
            : ""}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            dispatch({
              type: "SET_STATUS",
              playerId: player.id,
              status: "resting",
            })
          }
        >
          Rest
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-red-700 hover:bg-red-50 hover:text-red-800"
          onClick={() =>
            dispatch({
              type: "SET_STATUS",
              playerId: player.id,
              status: "left",
            })
          }
        >
          Remove
        </Button>
      </div>
    </li>
  );
}

export function WaitingStackPanel({
  state,
  dispatch,
  openCourtCount,
}: {
  state: EngineState;
  dispatch: (action: EngineAction) => void;
  openCourtCount: number;
}) {
  const stack = orderedWaitingPlayers(state);
  const perCourt = playersPerCourt(state.mode);
  const groups = groupWaitingStack(stack, perCourt);
  const separatedTeamLocks = findSeparatedTeamLocks(state);
  const stackIssueMessage = formatSeparatedTeamLockMessage(
    state,
    separatedTeamLocks,
  );
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  function clearDrag() {
    setDraggedId(null);
    setDragOverId(null);
  }

  function handleDragStart(event: DragEvent, playerId: string) {
    setDraggedId(playerId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", playerId);
  }

  function handleDragOver(event: DragEvent, playerId: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (playerId !== draggedId) {
      setDragOverId(playerId);
    }
  }

  function handleDrop(event: DragEvent, targetId: string) {
    event.preventDefault();
    const sourceId =
      draggedId ?? event.dataTransfer.getData("text/plain") ?? null;
    if (!sourceId) {
      clearDrag();
      return;
    }

    const reordered = reorderWaitingStackIds(
      stack.map((player) => player.id),
      sourceId,
      targetId,
    );
    if (reordered) {
      dispatch({ type: "REORDER_WAITING_QUEUE", playerIds: reordered });
    }
    clearDrag();
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold">
            Waiting stack{" "}
            <span className="text-[var(--muted)]">({stack.length})</span>
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Players group in sets of {perCourt}. Drag the handle to reorder,
            then push the stack to open courts.
          </p>
        </div>
        <Button
          disabled={stack.length < perCourt || openCourtCount === 0}
          onClick={() => tryStackPush(state, dispatch, { type: "FILL_COURTS" })}
        >
          Push stack to open courts
        </Button>
      </div>

      {stackIssueMessage ? (
        <div
          className="mb-4 rounded-lg border border-amber-400/50 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          role="alert"
        >
          <p className="font-medium">Team lock split in the stack</p>
          <p className="mt-1 text-xs">{stackIssueMessage}</p>
        </div>
      ) : null}

      {stack.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No players waiting. Check someone in to build the stack.
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map((group, groupIndex) => {
            const isNextUp = groupIndex === 0;
            const isComplete = group.length === perCourt;
            const baseIndex = groupIndex * perCourt;

            return (
              <section
                key={`group-${groupIndex}-${group.map((p) => p.id).join("-")}`}
                className={cn(
                  "rounded-xl border p-3",
                  isNextUp && isComplete
                    ? "border-[var(--accent)]/40 bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-[var(--surface-2)]",
                )}
              >
                <header className="mb-2 flex items-center justify-between gap-2">
                  <h3
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wide",
                      isNextUp && isComplete
                        ? "text-[var(--accent-fg-soft)]"
                        : "text-[var(--muted)]",
                    )}
                  >
                    {groupLabel(groupIndex, perCourt, group.length)}
                  </h3>
                  {isNextUp && isComplete ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        speakAnnouncement(
                          formatPrepareAnnouncement(group.map((p) => p.name)),
                        )
                      }
                    >
                      Announce prepare
                    </Button>
                  ) : !isComplete ? (
                    <span className="text-xs text-[var(--muted)]">
                      Needs {perCourt - group.length} more
                    </span>
                  ) : null}
                </header>

                <ol className="space-y-2">
                  {group.map((player, indexInGroup) => (
                    <SortablePlayerRow
                      key={player.id}
                      player={player}
                      stackIndex={baseIndex + indexInGroup}
                      state={state}
                      dispatch={dispatch}
                      draggedId={draggedId}
                      dragOverId={dragOverId}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDragLeave={() => setDragOverId(null)}
                      onDrop={handleDrop}
                      onDragEnd={clearDrag}
                    />
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
