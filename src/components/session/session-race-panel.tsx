"use client";

import {
  Crown,
  Medal,
  Shield,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Users,
  Repeat,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { EngineState } from "@/engine";
import {
  formatPointDiff,
  formatRaceStatus,
  formatRecord,
  formatStreakMark,
  formatWinRate,
  raceHonors,
  raceRow,
  sessionRace,
  type RaceTag,
  type SessionRace,
} from "@/lib/session-race";
import { cn } from "@/lib/utils";

const CARD =
  "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[inset_0_1px_0_0_color-mix(in_srgb,var(--highlight)_16%,transparent)]";

const HONOR_ICON: Record<
  ReturnType<typeof raceHonors>[number]["id"],
  LucideIcon
> = {
  best: Trophy,
  undefeated: Shield,
  comeback: Repeat,
  holding: Crown,
  closest: Target,
  widest: Zap,
  "most-games": Timer,
};

const TAG_ICON: Record<RaceTag, LucideIcon> = {
  Best: Trophy,
  Tied: Users,
  Leading: TrendingUp,
  Comeback: Repeat,
  "No losses": Shield,
  Holding: Crown,
};

export function SessionRacePanel({ state }: { state: EngineState }) {
  const race = sessionRace(state);
  return (
    <div className="space-y-4">
      <SessionHonors race={race} />
      <SessionStandings race={race} />
    </div>
  );
}

export function SessionHonors({ race }: { race: SessionRace }) {
  const honors = raceHonors(race);
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--highlight)]">
          <Trophy className="h-3.5 w-3.5" aria-hidden />
          Session
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-2xl">
          Race
        </h2>
        <p className="text-sm text-[var(--muted)]">{race.summary}</p>
      </div>
      {honors.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          Best player, unbeaten runs, and comebacks show up after the first
          reported win.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {honors.map((honor) => (
            <HonorCard key={honor.id} honor={honor} />
          ))}
        </div>
      )}
    </section>
  );
}

function HonorCard({
  honor,
}: {
  honor: ReturnType<typeof raceHonors>[number];
}) {
  const names = honorNameList(honor.body);
  const Icon = HONOR_ICON[honor.id];
  const wide = names != null && names.length > 2;

  return (
    <article className={cn(CARD, wide && "sm:col-span-2 xl:col-span-3")}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--highlight)]">
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {honor.title}
        </p>
        <p className="text-sm text-[var(--muted)]">{honor.detail}</p>
      </div>
      {names ? (
        <ul
          className={cn(
            "mt-3 grid gap-2",
            wide ? "sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1",
          )}
        >
          {names.map((name, index) => (
            <li
              key={`${honor.id}-${index}`}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm font-medium"
            >
              {name}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 font-[family-name:var(--font-display)] text-2xl leading-snug">
          {honor.body}
        </p>
      )}
    </article>
  );
}

/** "Ana, Ben & Cara" back into names. A score like "11–9" stays one line. */
function honorNameList(body: string): string[] | null {
  if (!/, | & /.test(body)) return null;
  const names = body
    .split(/, | & /)
    .map((name) => name.trim())
    .filter(Boolean);
  return names.length > 1 ? names : null;
}

export function SessionStandings({ race }: { race: SessionRace }) {
  const played = race.rows.some(
    (row) => row.decided > 0 || row.gamesPlayed > 0,
  );
  if (!played) return null;

  return (
    <section className={CARD}>
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--highlight)]">
        <Medal className="h-3.5 w-3.5" aria-hidden />
        Results
      </p>
      <h2 className="mt-1 mb-3 font-[family-name:var(--font-display)] text-2xl">
        Standings
      </h2>
      <div className="max-h-96 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            <tr>
              <th className="py-2 pr-3 font-medium">#</th>
              <th className="py-2 pr-3 font-medium">Player</th>
              <th className="px-2 py-2 text-right font-medium">Record</th>
              <th className="px-2 py-2 text-right font-medium">Win%</th>
              <th className="px-2 py-2 text-right font-medium">Streak</th>
              <th className="px-2 py-2 text-right font-medium">Games</th>
              {race.showPointDiff ? (
                <th className="py-2 pl-2 text-right font-medium">+/-</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {race.rows.map((row, index) => {
              const status = formatRaceStatus(row.status);
              return (
                <tr
                  key={row.playerId}
                  className="border-t border-[var(--border)]"
                >
                  <td className="py-2 pr-3 tabular-nums text-[var(--highlight)]">
                    {race.ranks[index]}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium">{row.name}</span>
                      {row.tag ? <RaceTag tag={row.tag} /> : null}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                      {status ? <span>{status}</span> : null}
                      {row.form.length > 0 ? (
                        <span aria-label={`Last results ${row.form.join(" ")}`}>
                          {row.form.map((result, formIndex) => (
                            <span
                              key={`${row.playerId}-${formIndex}`}
                              className={
                                result === "W"
                                  ? "mr-1 text-[var(--highlight)]"
                                  : "mr-1"
                              }
                            >
                              {result}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatRecord(row.wins, row.losses)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-[var(--muted)]">
                    {formatWinRate(row.winRate)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatStreakMark(row.streak)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-[var(--muted)]">
                    {row.gamesPlayed}
                  </td>
                  {race.showPointDiff ? (
                    <td className="py-2 pl-2 text-right tabular-nums">
                      {row.pointsFor + row.pointsAgainst > 0
                        ? formatPointDiff(row.pointDiff)
                        : "\u2014"}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function RaceTag({ tag }: { tag: RaceTag }) {
  const Icon = TAG_ICON[tag];
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent-fg-soft)]">
      <Icon className="h-3 w-3" aria-hidden />
      {tag}
    </span>
  );
}

export function RaceName({
  race,
  playerId,
  name,
  className,
}: {
  race: SessionRace;
  playerId: string;
  name: string;
  className?: string;
}) {
  const row = raceRow(race, playerId);
  const record =
    row && row.decided > 0 ? formatRecord(row.wins, row.losses) : null;
  const streak =
    row && Math.abs(row.streak) >= 2 ? formatStreakMark(row.streak) : null;

  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-x-2 gap-y-1",
        className,
      )}
    >
      <span>{name}</span>
      {record ? (
        <span className="tabular-nums text-xs text-[var(--muted)]">
          {record}
        </span>
      ) : null}
      {streak ? (
        <span className="tabular-nums text-xs text-[var(--muted)]">
          {streak}
        </span>
      ) : null}
      {row?.tag ? <RaceTag tag={row.tag} /> : null}
    </span>
  );
}
