"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import {
  endSessionAction,
  guestCheckInAction,
  hostDispatchAction,
} from "@/app/actions/session";
import { HostConsole } from "@/components/session/host-console";
import { PlayerView } from "@/components/session/player-view";
import { SessionQr } from "@/components/session/session-qr";
import { Wallboard } from "@/components/session/wallboard";
import {
  createInitialState,
  type EngineAction,
  type EngineState,
  type SessionMode,
} from "@/engine";
import { createClient } from "@/lib/supabase/client";
import { dbToEngineState } from "@/lib/session-mapper";
import { formatSkillTier } from "@/lib/skill-tier";
import type { FacilityConfig } from "@/lib/facility";
import type { Database } from "@/lib/supabase/database.types";

type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
type SessionPlayerRow = Database["public"]["Tables"]["session_players"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type CourtRow = Database["public"]["Tables"]["courts"]["Row"];
type PairingRow = Database["public"]["Tables"]["pairing_history"]["Row"];

export function LiveSessionApp({
  token,
  initial,
  mode,
  playerUrl,
  boardUrl,
}: {
  token: string;
  initial: {
    session: SessionRow;
    players: SessionPlayerRow[];
    matches: MatchRow[];
    courts: CourtRow[];
    pairings: PairingRow[];
    facility: FacilityConfig | null;
  };
  mode: "host" | "player" | "board";
  playerUrl: string;
  boardUrl: string;
}) {
  const [bundle, setBundle] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [ended, setEnded] = useState(initial.session.status === "completed");
  const facility = bundle.facility;

  const state: EngineState = useMemo(() => {
    return dbToEngineState({
      session: bundle.session,
      players: bundle.players,
      matches: bundle.matches,
      courts: bundle.courts,
      pairings: bundle.pairings,
    });
  }, [bundle]);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data: session } = await supabase
      .from("sessions")
      .select("*")
      .eq("public_token", token)
      .single();
    if (!session) return;

    const [
      { data: players },
      { data: matches },
      { data: courts },
      { data: pairings },
    ] = await Promise.all([
      supabase.from("session_players").select("*").eq("session_id", session.id),
      supabase.from("matches").select("*").eq("session_id", session.id),
      supabase
        .from("courts")
        .select("*")
        .eq("venue_id", session.venue_id)
        .order("sort_order"),
      supabase.from("pairing_history").select("*").eq("session_id", session.id),
    ]);

    setBundle((prev) => ({
      session,
      players: players ?? [],
      matches: matches ?? [],
      courts: courts ?? [],
      pairings: pairings ?? [],
      facility: prev.facility,
    }));
    setEnded(session.status === "completed");
  }, [token]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`session:${token}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_players" },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions" },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [token, refresh]);

  function dispatch(action: EngineAction) {
    startTransition(async () => {
      let payload: Parameters<typeof hostDispatchAction>[1] | null = null;

      switch (action.type) {
        case "FILL_COURTS":
          payload = { type: "FILL_COURTS" };
          break;
        case "PUSH_TO_COURT":
          payload = { type: "PUSH_TO_COURT", courtId: action.courtId };
          break;
        case "REORDER_WAITING_QUEUE":
          payload = {
            type: "REORDER_WAITING_QUEUE",
            playerIds: action.playerIds,
          };
          break;
        case "MOVE_WAITING_QUEUE":
          payload = {
            type: "MOVE_WAITING_QUEUE",
            playerId: action.playerId,
            direction: action.direction,
          };
          break;
        case "START_MATCH":
          payload = { type: "START_MATCH", matchId: action.matchId };
          break;
        case "RETURN_TO_STACK":
          payload = { type: "RETURN_TO_STACK", matchId: action.matchId };
          break;
        case "COMPLETE_MATCH":
          payload = {
            type: "COMPLETE_MATCH",
            matchId: action.matchId,
            winner: action.winner,
          };
          break;
        case "SET_MODE":
          payload = { type: "SET_MODE", mode: action.mode };
          break;
        case "SET_MAX_GAME_MINUTES":
          payload = {
            type: "SET_MAX_GAME_MINUTES",
            minutes: action.minutes,
          };
          break;
        case "SHUFFLE_TEAMS":
          payload = { type: "SHUFFLE_TEAMS", matchId: action.matchId };
          break;
        case "CHECK_IN":
          payload = {
            type: "CHECK_IN",
            name: action.player.name,
            skill: action.player.skill,
          };
          break;
        case "SET_STATUS":
          if (
            action.status === "waiting" ||
            action.status === "resting" ||
            action.status === "left"
          ) {
            payload = {
              type: "SET_STATUS",
              playerId: action.playerId,
              status: action.status,
            };
          }
          break;
        case "SET_PARTNER_LOCK":
          payload = {
            type: "SET_PARTNER_LOCK",
            playerId: action.playerId,
            partnerId: action.partnerId,
          };
          break;
        case "SET_TEAM_LOCK":
          payload = { type: "SET_TEAM_LOCK", playerIds: action.playerIds };
          break;
        case "CLEAR_TEAM_LOCK":
          payload = { type: "CLEAR_TEAM_LOCK", playerId: action.playerId };
          break;
        default:
          toast.message("Override applied locally — syncing…");
          break;
      }

      if (!payload) return;
      const result = await hostDispatchAction(token, payload);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      await refresh();
    });
  }

  async function onGuestCheckIn(action: EngineAction) {
    if (action.type !== "CHECK_IN") return;
    const result = await guestCheckInAction(
      token,
      action.player.name,
      action.player.skill,
    );
    if (result && "error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    await refresh();
  }

  if (ended && mode !== "board") {
    const summaryState = state;
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-12">
        <h1 className="font-[family-name:var(--font-display)] text-4xl">
          Session complete
        </h1>
        <SessionSummaryList state={summaryState} />
      </div>
    );
  }

  if (mode === "board") {
    return <Wallboard state={state} facility={facility} />;
  }

  if (mode === "player") {
    return (
      <PlayerView state={state} facility={facility} dispatch={onGuestCheckIn} />
    );
  }

  return (
    <div className="space-y-4 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-start gap-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <SessionQr url={playerUrl} />
        <div className="space-y-2 text-sm">
          <p className="font-medium">Player join QR</p>
          <p className="break-all text-[var(--muted)]">{playerUrl}</p>
          <p className="text-[var(--muted)]">
            Status: {pending ? "Syncing…" : bundle.session.status}
          </p>
        </div>
      </div>
      <HostConsole
        state={state}
        dispatch={dispatch}
        boardUrl={boardUrl}
        isPending={pending}
        onEndSession={() => {
          startTransition(async () => {
            await endSessionAction(token);
            setEnded(true);
            await refresh();
          });
        }}
      />
    </div>
  );
}

function SessionSummaryList({ state }: { state: EngineState }) {
  const rows = [...state.players]
    .filter((p) => p.status !== "left" || p.gamesPlayed > 0)
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed);

  return (
    <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      {rows.map((row, i) => (
        <li
          key={row.id}
          className="flex items-center justify-between px-4 py-3 text-sm"
        >
          <span>
            {i + 1}. {row.name}
          </span>
          <span className="text-[var(--muted)]">
            {row.gamesPlayed} games · {formatSkillTier(row.skill)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function EmptyEngineFallback() {
  return createInitialState();
}

export type { SessionMode };
