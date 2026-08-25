import { recordMatchPairings } from "./history";
import { proposeFillCourts } from "./matchmaking";
import {
  applyWaitingQueueOrder,
  moveWaitingPlayer,
  nextQueueOrder,
  orderedWaitingPlayers,
} from "./queue";
import { clampMaxGameMinutes } from "./timer";
import type {
  EngineAction,
  EngineMatch,
  EnginePlayer,
  EngineState,
  SessionSummary,
} from "./types";

export function createInitialState(
  partial?: Partial<EngineState>,
): EngineState {
  return {
    mode: "rotating",
    courts: [
      { id: "c1", name: "Court 1" },
      { id: "c2", name: "Court 2" },
      { id: "c3", name: "Court 3" },
    ],
    players: [],
    matches: [],
    partnerHistory: {},
    opponentHistory: {},
    now: Date.now(),
    kingMaxConsecutiveWins: 3,
    maxGameMinutes: 15,
    ...partial,
  };
}

function appendToWaitingQueue(
  state: EngineState,
  playerIds: string[],
): EngineState {
  const waitingIds = orderedWaitingPlayers(state).map((p) => p.id);
  const without = waitingIds.filter((id) => !playerIds.includes(id));
  const appended = playerIds.filter((id) =>
    state.players.some((p) => p.id === id && p.status === "waiting"),
  );
  return applyWaitingQueueOrder(state, [...without, ...appended]);
}

function fillCourtsFromStack(
  state: EngineState,
  courtIds?: string[],
): EngineState {
  const proposals = proposeFillCourts(state, { courtIds });
  let next = state;
  for (const p of proposals) {
    next = applyAssignment(next, p.courtId, p.teamA, p.teamB);
  }
  return next;
}

function updatePlayer(
  players: EnginePlayer[],
  id: string,
  patch: Partial<EnginePlayer>,
): EnginePlayer[] {
  return players.map((p) => (p.id === id ? { ...p, ...patch } : p));
}

function isOccupied(status: EngineMatch["status"]) {
  return status === "ready" || status === "active";
}

function applyAssignment(
  state: EngineState,
  courtId: string,
  teamA: string[],
  teamB: string[],
): EngineState {
  const court = state.courts.find((c) => c.id === courtId);
  if (!court) return state;

  const existing = state.matches.find(
    (m) => m.courtId === courtId && isOccupied(m.status),
  );
  if (existing) return state;

  const allIds = [...teamA, ...teamB];
  let players = state.players;
  for (const id of allIds) {
    const p = players.find((x) => x.id === id);
    if (!p || p.status !== "waiting") return state;
  }

  for (const id of allIds) {
    players = updatePlayer(players, id, { status: "playing" });
  }

  const match: EngineMatch = {
    id: `m_${courtId}_${state.now}_${Math.random().toString(36).slice(2, 7)}`,
    courtId,
    courtName: court.name,
    teamA,
    teamB,
    status: "ready",
    startedAt: null,
  };

  return {
    ...state,
    players,
    matches: [...state.matches, match],
  };
}

function startMatch(state: EngineState, matchId: string): EngineState {
  const match = state.matches.find((m) => m.id === matchId);
  if (!match || match.status !== "ready") return state;
  return {
    ...state,
    matches: state.matches.map((m) =>
      m.id === matchId ? { ...m, status: "active", startedAt: state.now } : m,
    ),
  };
}

function clearCourt(state: EngineState, matchId: string): EngineState {
  const match = state.matches.find((m) => m.id === matchId);
  if (!match || !isOccupied(match.status)) return state;

  const allIds = [...match.teamA, ...match.teamB];
  let players = state.players;
  let partnerHistory = state.partnerHistory;
  let opponentHistory = state.opponentHistory;

  if (match.status === "active") {
    const recorded = recordMatchPairings(
      state.partnerHistory,
      state.opponentHistory,
      match.teamA,
      match.teamB,
    );
    partnerHistory = recorded.partnerHistory;
    opponentHistory = recorded.opponentHistory;

    for (const id of allIds) {
      const p = players.find((x) => x.id === id)!;
      players = updatePlayer(players, id, {
        gamesPlayed: p.gamesPlayed + 1,
        lastPlayedAt: state.now,
        status: "waiting",
        consecutiveWins: 0,
      });
    }
  } else {
    for (const id of allIds) {
      players = updatePlayer(players, id, { status: "waiting" });
    }
  }

  const completed: EngineMatch = {
    ...match,
    status: "completed",
    winner: null,
    endedAt: state.now,
  };

  const cleared = appendToWaitingQueue(
    {
      ...state,
      players,
      partnerHistory,
      opponentHistory,
      matches: state.matches.map((m) => (m.id === matchId ? completed : m)),
    },
    allIds,
  );

  return fillCourtsFromStack(cleared, [match.courtId]);
}

function completeMatch(
  state: EngineState,
  matchId: string,
  winner: "a" | "b",
): EngineState {
  const match = state.matches.find((m) => m.id === matchId);
  if (!match || match.status !== "active") return state;

  const { partnerHistory, opponentHistory } = recordMatchPairings(
    state.partnerHistory,
    state.opponentHistory,
    match.teamA,
    match.teamB,
  );

  let players = state.players;
  const winners = winner === "a" ? match.teamA : match.teamB;
  const losers = winner === "a" ? match.teamB : match.teamA;
  const allIds = [...match.teamA, ...match.teamB];

  for (const id of allIds) {
    const p = players.find((x) => x.id === id)!;
    players = updatePlayer(players, id, {
      gamesPlayed: p.gamesPlayed + 1,
      lastPlayedAt: state.now,
      status: "waiting",
      consecutiveWins: 0,
    });
  }

  if (state.mode === "king_of_court") {
    for (const id of winners) {
      const p = players.find((x) => x.id === id)!;
      const nextWins = (p.consecutiveWins ?? 0) + 1;
      const stay = nextWins < state.kingMaxConsecutiveWins;
      players = updatePlayer(players, id, {
        consecutiveWins: stay ? nextWins : 0,
        status: stay ? "playing" : "waiting",
      });
    }
    for (const id of losers) {
      players = updatePlayer(players, id, {
        status: "waiting",
        consecutiveWins: 0,
      });
    }

    const completed: EngineMatch = {
      ...match,
      status: "completed",
      winner,
      endedAt: state.now,
    };

    let next: EngineState = {
      ...state,
      players,
      partnerHistory,
      opponentHistory,
      matches: state.matches.map((m) => (m.id === matchId ? completed : m)),
    };

    const stayers = winners.filter(
      (id) => players.find((p) => p.id === id)?.status === "playing",
    );

    if (stayers.length === winners.length) {
      const perSide = winners.length;
      for (const id of stayers) {
        next = {
          ...next,
          players: updatePlayer(next.players, id, { status: "waiting" }),
        };
      }

      const pool = orderedWaitingPlayers(next).filter(
        (p) => !winners.includes(p.id),
      );

      if (pool.length >= perSide) {
        const challengers = pool.slice(0, perSide).map((p) => p.id);
        next = applyAssignment(next, match.courtId, winners, challengers);
        for (const id of winners) {
          next = {
            ...next,
            players: updatePlayer(next.players, id, {
              consecutiveWins:
                (players.find((p) => p.id === id)?.consecutiveWins ?? 0) || 1,
            }),
          };
        }
      }
      return appendToWaitingQueue(next, allIds);
    }

    return appendToWaitingQueue(next, allIds);
  }

  const completed: EngineMatch = {
    ...match,
    status: "completed",
    winner,
    endedAt: state.now,
  };

  return appendToWaitingQueue(
    {
      ...state,
      players,
      partnerHistory,
      opponentHistory,
      matches: state.matches.map((m) => (m.id === matchId ? completed : m)),
    },
    allIds,
  );
}

function swapPlayers(
  state: EngineState,
  playerIdA: string,
  playerIdB: string,
): EngineState {
  const matchA = state.matches.find(
    (m) => isOccupied(m.status) && [...m.teamA, ...m.teamB].includes(playerIdA),
  );
  const matchB = state.matches.find(
    (m) => isOccupied(m.status) && [...m.teamA, ...m.teamB].includes(playerIdB),
  );

  if (!matchA && !matchB) return state;

  let matches = state.matches;
  if (matchA && matchB && matchA.id === matchB.id) {
    matches = state.matches.map((m) => {
      if (m.id !== matchA.id) return m;
      const swapId = (id: string) =>
        id === playerIdA ? playerIdB : id === playerIdB ? playerIdA : id;
      return {
        ...m,
        teamA: m.teamA.map(swapId),
        teamB: m.teamB.map(swapId),
      };
    });
    return { ...state, matches };
  }

  if (matchA && matchB) {
    matches = matches.map((m) => {
      if (m.id === matchA.id) {
        const swapId = (id: string) => (id === playerIdA ? playerIdB : id);
        return { ...m, teamA: m.teamA.map(swapId), teamB: m.teamB.map(swapId) };
      }
      if (m.id === matchB.id) {
        const swapId = (id: string) => (id === playerIdB ? playerIdA : id);
        return { ...m, teamA: m.teamA.map(swapId), teamB: m.teamB.map(swapId) };
      }
      return m;
    });
    return { ...state, matches };
  }

  const playingMatch = matchA ?? matchB!;
  const onCourt = matchA ? playerIdA : playerIdB;
  const waitingId = matchA ? playerIdB : playerIdA;
  const waitingPlayer = state.players.find((p) => p.id === waitingId);
  if (!waitingPlayer || waitingPlayer.status !== "waiting") return state;

  matches = matches.map((m) => {
    if (m.id !== playingMatch.id) return m;
    const swapId = (id: string) => (id === onCourt ? waitingId : id);
    return { ...m, teamA: m.teamA.map(swapId), teamB: m.teamB.map(swapId) };
  });

  return {
    ...state,
    matches,
    players: state.players.map((p) => {
      if (p.id === onCourt) return { ...p, status: "waiting" };
      if (p.id === waitingId) return { ...p, status: "playing" };
      return p;
    }),
  };
}

function shuffleTeams(state: EngineState, matchId: string): EngineState {
  const match = state.matches.find((m) => m.id === matchId);
  if (!match || !isOccupied(match.status)) return state;
  const all = [...match.teamA, ...match.teamB];
  if (all.length < 2) return state;
  if (all.length === 4) {
    const [a1, a2, b1, b2] = all;
    return {
      ...state,
      matches: state.matches.map((m) =>
        m.id === matchId ? { ...m, teamA: [a1, b1], teamB: [a2, b2] } : m,
      ),
    };
  }
  if (all.length === 2) {
    return {
      ...state,
      matches: state.matches.map((m) =>
        m.id === matchId ? { ...m, teamA: [all[1]], teamB: [all[0]] } : m,
      ),
    };
  }
  return state;
}

export function reduce(state: EngineState, action: EngineAction): EngineState {
  switch (action.type) {
    case "TICK":
      return { ...state, now: action.now };

    case "SET_MODE":
      return { ...state, mode: action.mode };

    case "SET_MAX_GAME_MINUTES":
      return {
        ...state,
        maxGameMinutes: clampMaxGameMinutes(action.minutes),
      };

    case "CHECK_IN": {
      if (state.players.some((p) => p.id === action.player.id)) {
        const next = {
          ...state,
          players: updatePlayer(state.players, action.player.id, {
            status: "waiting",
            name: action.player.name,
            skill: action.player.skill,
            partnerLockId: action.player.partnerLockId,
            avoidIds: action.player.avoidIds,
          }),
        };
        return appendToWaitingQueue(next, [action.player.id]);
      }
      const minGames = state.players
        .filter((p) => p.status !== "left")
        .reduce(
          (min, p) => Math.min(min, p.gamesPlayed),
          Number.POSITIVE_INFINITY,
        );
      const lateJoinGames = Number.isFinite(minGames) ? minGames : 0;
      const player: EnginePlayer = {
        ...action.player,
        status: "waiting",
        gamesPlayed: lateJoinGames,
        lastPlayedAt: null,
        checkedInAt: state.now,
        consecutiveWins: 0,
        queueOrder: nextQueueOrder(state),
      };
      const next = { ...state, players: [...state.players, player] };
      return appendToWaitingQueue(next, [player.id]);
    }

    case "SET_STATUS": {
      const leaving = action.status === "left";
      const removed = state.players.find((p) => p.id === action.playerId);
      const teamGroupId = leaving ? (removed?.teamLockGroupId ?? null) : null;

      let players = updatePlayer(state.players, action.playerId, {
        status: action.status,
        consecutiveWins:
          action.status === "resting" || action.status === "left"
            ? 0
            : undefined,
        ...(leaving ? { partnerLockId: null, teamLockGroupId: null } : {}),
      });

      if (leaving) {
        players = players.map((p) => {
          if (p.id === action.playerId) return p;
          const clearPartner = p.partnerLockId === action.playerId;
          const clearTeam = Boolean(
            teamGroupId && p.teamLockGroupId === teamGroupId,
          );
          if (!clearPartner && !clearTeam) return p;
          return {
            ...p,
            partnerLockId: clearPartner ? null : p.partnerLockId,
            teamLockGroupId: clearTeam ? null : p.teamLockGroupId,
          };
        });
      }

      const next = { ...state, players };
      if (action.status === "waiting") {
        return appendToWaitingQueue(next, [action.playerId]);
      }
      if (action.status === "resting" || action.status === "left") {
        return applyWaitingQueueOrder(
          next,
          orderedWaitingPlayers(next).map((p) => p.id),
        );
      }
      return next;
    }

    case "SET_PARTNER_LOCK":
      return {
        ...state,
        players: updatePlayer(state.players, action.playerId, {
          partnerLockId: action.partnerId,
        }),
      };

    case "SET_TEAM_LOCK": {
      const groupId = `team_${state.now}_${Math.random().toString(36).slice(2, 8)}`;
      const ids = new Set(action.playerIds);
      return {
        ...state,
        players: state.players.map((p) =>
          ids.has(p.id) ? { ...p, teamLockGroupId: groupId } : p,
        ),
      };
    }

    case "CLEAR_TEAM_LOCK": {
      const player = state.players.find((p) => p.id === action.playerId);
      if (!player?.teamLockGroupId) return state;
      const groupId = player.teamLockGroupId;
      return {
        ...state,
        players: state.players.map((p) =>
          p.teamLockGroupId === groupId ? { ...p, teamLockGroupId: null } : p,
        ),
      };
    }

    case "SET_AVOID":
      return {
        ...state,
        players: updatePlayer(state.players, action.playerId, {
          avoidIds: action.avoidIds,
        }),
      };

    case "FILL_COURTS":
      return fillCourtsFromStack(state, action.courtIds);

    case "PUSH_TO_COURT":
      return fillCourtsFromStack(state, [action.courtId]);

    case "REORDER_WAITING_QUEUE":
      return applyWaitingQueueOrder(state, action.playerIds);

    case "MOVE_WAITING_QUEUE":
      return moveWaitingPlayer(state, action.playerId, action.direction);

    case "START_MATCH":
      return startMatch(state, action.matchId);

    case "CLEAR_COURT":
      return clearCourt(state, action.matchId);

    case "COMPLETE_MATCH":
      return completeMatch(state, action.matchId, action.winner);

    case "FORCE_ASSIGN":
      return applyAssignment(state, action.courtId, action.teamA, action.teamB);

    case "SWAP_PLAYERS":
      return swapPlayers(state, action.playerIdA, action.playerIdB);

    case "SHUFFLE_TEAMS":
      return shuffleTeams(state, action.matchId);

    default:
      return state;
  }
}

export function summarizeSession(state: EngineState): SessionSummary[] {
  const wins = new Map<string, number>();
  for (const m of state.matches) {
    if (m.status !== "completed" || !m.winner) continue;
    const winners = m.winner === "a" ? m.teamA : m.teamB;
    for (const id of winners) {
      wins.set(id, (wins.get(id) ?? 0) + 1);
    }
  }

  return state.players
    .filter((p) => p.status !== "left" || p.gamesPlayed > 0)
    .map((p) => ({
      playerId: p.id,
      name: p.name,
      gamesPlayed: p.gamesPlayed,
      wins: wins.get(p.id) ?? 0,
      skill: p.skill,
    }))
    .sort((a, b) => b.wins - a.wins || b.gamesPlayed - a.gamesPlayed);
}

export function occupiedMatches(state: EngineState): EngineMatch[] {
  return state.matches.filter((m) => isOccupied(m.status));
}

/** Includes ready + active courts (staged or playing). */
export function activeMatches(state: EngineState): EngineMatch[] {
  return occupiedMatches(state);
}

export function playerName(state: EngineState, id: string): string {
  return state.players.find((p) => p.id === id)?.name ?? id;
}
