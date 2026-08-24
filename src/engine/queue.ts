import type { EnginePlayer, EngineState } from "./types";

function fairnessCompare(state: EngineState, a: EnginePlayer, b: EnginePlayer) {
  if (a.gamesPlayed !== b.gamesPlayed) {
    return a.gamesPlayed - b.gamesPlayed;
  }
  const aWait = state.now - (a.lastPlayedAt ?? a.checkedInAt);
  const bWait = state.now - (b.lastPlayedAt ?? b.checkedInAt);
  return bWait - aWait;
}

/** Waiting players in host stack order (queueOrder), then fairness tie-break. */
export function orderedWaitingPlayers(state: EngineState): EnginePlayer[] {
  return state.players
    .filter((p) => p.status === "waiting")
    .sort((a, b) => {
      const ao = a.queueOrder;
      const bo = b.queueOrder;
      if (ao != null && bo != null && ao !== bo) return ao - bo;
      if (ao != null && bo == null) return -1;
      if (ao == null && bo != null) return 1;
      return fairnessCompare(state, a, b);
    });
}

export function nextQueueOrder(state: EngineState): number {
  const waiting = state.players.filter((p) => p.status === "waiting");
  if (waiting.length === 0) return 0;
  return (
    waiting.reduce(
      (max, p) => Math.max(max, p.queueOrder ?? -1),
      Number.NEGATIVE_INFINITY,
    ) + 1
  );
}

export function applyWaitingQueueOrder(
  state: EngineState,
  orderedIds: string[],
): EngineState {
  const waitingIds = new Set(
    state.players.filter((p) => p.status === "waiting").map((p) => p.id),
  );
  const validIds = orderedIds.filter((id) => waitingIds.has(id));
  const trailing = [...waitingIds].filter((id) => !validIds.includes(id));
  const finalOrder = [...validIds, ...trailing];

  let players = state.players;
  finalOrder.forEach((id, index) => {
    players = players.map((p) =>
      p.id === id ? { ...p, queueOrder: index } : p,
    );
  });
  return { ...state, players };
}

/** Split the waiting stack into court-sized groups (4 for doubles, 2 for singles). */
export function groupWaitingStack(
  players: EnginePlayer[],
  groupSize: number,
): EnginePlayer[][] {
  if (groupSize < 1) return [];
  const groups: EnginePlayer[][] = [];
  for (let i = 0; i < players.length; i += groupSize) {
    groups.push(players.slice(i, i + groupSize));
  }
  return groups;
}

export function reorderWaitingStackIds(
  ids: string[],
  sourceId: string,
  targetId: string,
): string[] | null {
  const from = ids.indexOf(sourceId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return null;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, sourceId);
  return next;
}

export function moveWaitingPlayer(
  state: EngineState,
  playerId: string,
  direction: "up" | "down",
): EngineState {
  const ordered = orderedWaitingPlayers(state);
  const index = ordered.findIndex((p) => p.id === playerId);
  if (index < 0) return state;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ordered.length) return state;
  const ids = ordered.map((p) => p.id);
  [ids[index], ids[target]] = [ids[target], ids[index]];
  return applyWaitingQueueOrder(state, ids);
}
