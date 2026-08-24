import type { EnginePlayer, EngineState, SessionMode } from "./types";
import { orderedWaitingPlayers } from "./queue";

function playersPerCourt(mode: SessionMode): number {
  return mode === "singles" ? 2 : 4;
}

export function teamLockMembers(
  state: EngineState,
  groupId: string,
): EnginePlayer[] {
  return state.players.filter(
    (p) => p.status === "waiting" && p.teamLockGroupId === groupId,
  );
}

export function formatTeamLockLabel(
  state: EngineState,
  groupId: string,
): string {
  const names = teamLockMembers(state, groupId).map((p) => p.name);
  return names.join(" · ");
}

/** Pull the next court-sized set from the pool, keeping team locks intact. */
export function takeNextCourtPlayers(
  pool: EnginePlayer[],
  perCourt: number,
  state: EngineState,
): EnginePlayer[] | null {
  const poolIds = new Set(pool.map((p) => p.id));
  const selected: EnginePlayer[] = [];
  const selectedIds = new Set<string>();

  for (const p of pool) {
    if (selectedIds.has(p.id)) continue;

    const batch = p.teamLockGroupId
      ? orderedWaitingPlayers(state).filter(
          (x) => x.teamLockGroupId === p.teamLockGroupId,
        )
      : [p];

    if (p.teamLockGroupId && batch.length !== perCourt) {
      return null;
    }

    for (const member of batch) {
      if (!poolIds.has(member.id)) return null;
      if (selectedIds.has(member.id)) continue;
      selected.push(member);
      selectedIds.add(member.id);
      if (selected.length > perCourt) return null;
    }

    if (selected.length === perCourt) {
      return selected;
    }
  }

  return null;
}

export function findSeparatedTeamLocks(state: EngineState): Array<{
  groupId: string;
  names: string[];
}> {
  const stack = orderedWaitingPlayers(state);
  const groupIds = [
    ...new Set(
      stack
        .map((player) => player.teamLockGroupId)
        .filter((groupId): groupId is string => Boolean(groupId)),
    ),
  ];

  const issues: Array<{ groupId: string; names: string[] }> = [];

  for (const groupId of groupIds) {
    const members = teamLockMembers(state, groupId);
    const indices = members
      .map((member) => stack.findIndex((player) => player.id === member.id))
      .sort((a, b) => a - b);
    const contiguous = indices.every(
      (index, i) => i === 0 || index === indices[i - 1] + 1,
    );
    if (!contiguous) {
      issues.push({
        groupId,
        names: members.map((member) => member.name),
      });
    }
  }

  return issues;
}

export function formatSeparatedTeamLockMessage(
  state: EngineState,
  issues: Array<{ groupId: string; names: string[] }>,
): string {
  if (issues.length === 0) {
    return "";
  }
  if (issues.length === 1) {
    return `${formatTeamLockLabel(state, issues[0].groupId)} must be grouped together in the waiting stack before pushing.`;
  }
  const labels = issues.map((issue) =>
    formatTeamLockLabel(state, issue.groupId),
  );
  return `These team locks must be grouped together before pushing: ${labels.join("; ")}.`;
}

export function validateTeamLockPlayerIds(
  state: EngineState,
  playerIds: string[],
  mode: EngineState["mode"],
): string | null {
  const perCourt = playersPerCourt(mode);
  if (playerIds.length !== perCourt) {
    return `Select exactly ${perCourt} players for a team lock.`;
  }

  const unique = new Set(playerIds);
  if (unique.size !== playerIds.length) {
    return "Each player can only be selected once.";
  }

  for (const id of playerIds) {
    const player = state.players.find((p) => p.id === id);
    if (!player) return "Player not found.";
    if (player.status !== "waiting") {
      return "Team locks can only include waiting players.";
    }
  }

  return null;
}
