"use client";

import { useMemo, useState } from "react";
import type { EngineAction, EngineState } from "@/engine";
import { occupiedMatches, orderedWaitingPlayers, playerName } from "@/engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CourtTimer } from "@/components/session/court-timer";
import { formatBrandTitle, type FacilityConfig } from "@/lib/facility";
import { DEFAULT_SKILL_TIER, type SkillTier } from "@/lib/skill-tier";
import { SkillTierSelect } from "@/components/ui/skill-tier-select";

export function PlayerView({
  state,
  dispatch,
  allowSelfCheckIn = true,
  facility = null,
}: {
  state: EngineState;
  dispatch?: (action: EngineAction) => void;
  allowSelfCheckIn?: boolean;
  facility?: FacilityConfig | null;
}) {
  const [name, setName] = useState("");
  const [skill, setSkill] = useState<SkillTier>(DEFAULT_SKILL_TIER);
  const [me, setMe] = useState<string | null>(null);
  const courts = occupiedMatches(state);
  const waiting = orderedWaitingPlayers(state);

  const myPlayer = useMemo(
    () => state.players.find((p) => p.id === me) ?? null,
    [state.players, me],
  );

  const myMatch = useMemo(() => {
    if (!me) return null;
    return courts.find((m) => [...m.teamA, ...m.teamB].includes(me)) ?? null;
  }, [courts, me]);

  const queuePosition = useMemo(() => {
    if (!me || myPlayer?.status !== "waiting") return null;
    const idx = waiting.findIndex((p) => p.id === me);
    return idx >= 0 ? idx + 1 : null;
  }, [me, myPlayer, waiting]);

  function selfCheckIn() {
    if (!dispatch) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = `guest_${trimmed.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`;
    dispatch({
      type: "CHECK_IN",
      player: { id, name: trimmed, skill },
    });
    setMe(id);
    setName("");
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <header>
        <p className="text-xs tracking-wide text-[var(--muted)]">
          {formatBrandTitle(facility)}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Live session
        </h1>
      </header>

      {allowSelfCheckIn && dispatch && !me ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
          <h2 className="font-semibold">Check in</h2>
          <div className="space-y-1">
            <Label htmlFor="guest-name">Your name</Label>
            <Input
              id="guest-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
            />
          </div>
          <SkillTierSelect id="guest-skill" value={skill} onChange={setSkill} />
          <Button className="w-full" onClick={selfCheckIn}>
            Join queue
          </Button>
        </div>
      ) : null}

      {myPlayer ? (
        <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent-soft)] p-4">
          <p className="text-sm text-[var(--accent-fg-soft)]">You</p>
          <p className="text-xl font-semibold">{myPlayer.name}</p>
          {myMatch ? (
            <p className="mt-2 text-sm">
              On {myMatch.courtName}:{" "}
              {myMatch.teamA.map((id) => playerName(state, id)).join(" & ")} vs{" "}
              {myMatch.teamB.map((id) => playerName(state, id)).join(" & ")}
            </p>
          ) : queuePosition ? (
            <p className="mt-2 text-sm">Queue position #{queuePosition}</p>
          ) : (
            <p className="mt-2 text-sm capitalize">{myPlayer.status}</p>
          )}
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-semibold">Courts</h2>
        {courts.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No games in progress</p>
        ) : (
          courts.map((m) => (
            <article
              key={m.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="font-medium">{m.courtName}</h3>
                <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  {m.status === "ready" ? "Ready" : "Live"}
                </span>
              </div>
              <div className="mb-3">
                <CourtTimer
                  match={m}
                  maxGameMinutes={state.maxGameMinutes}
                  compact
                />
              </div>
              <p className="text-sm">
                {m.teamA.map((id) => playerName(state, id)).join(" & ")}
              </p>
              <p className="my-1 text-xs uppercase tracking-widest text-[var(--muted)]">
                vs
              </p>
              <p className="text-sm">
                {m.teamB.map((id) => playerName(state, id)).join(" & ")}
              </p>
            </article>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Up next</h2>
        <ol className="space-y-2">
          {waiting.slice(0, 12).map((p, i) => (
            <li
              key={p.id}
              className="flex justify-between rounded-lg bg-[var(--surface-2)] px-3 py-2 text-sm"
            >
              <span>
                {i + 1}. {p.name}
              </span>
              <span className="text-[var(--muted)]">{p.gamesPlayed}G</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
