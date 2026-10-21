import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";
import { PRODUCT_NAME } from "@/lib/facility";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  let signedIn = false;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = Boolean(user);
  }

  const ctaHref = signedIn ? "/dashboard" : "/login";
  const ctaLabel = signedIn ? "Open dashboard" : "Host login";
  const tournamentHref = signedIn ? "/tournament" : "/login?next=/tournament";
  const liveCourts = [
    {
      court: "Court 1",
      a: "Alex & Blake",
      b: "Casey & Drew",
      scoreA: 8,
      scoreB: 6,
    },
    {
      court: "Court 2",
      a: "Eden & Finley",
      b: "Gray & Harper",
      scoreA: 4,
      scoreB: 7,
    },
    {
      court: "Court 3",
      a: "Indie & Jordan",
      b: "Kai & Logan",
      scoreA: 10,
      scoreB: 9,
    },
  ];

  return (
    <main className="relative overflow-hidden">
      <div className="hero-wash pointer-events-none absolute inset-0" />

      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="brand-mark" role="img" aria-label={PRODUCT_NAME} />
        <Button asChild>
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      </nav>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-10 px-6 pb-20 pt-10 md:grid-cols-[1.1fr_0.9fr] md:items-center md:pt-16">
        <div className="animate-rise space-y-6">
          <p className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">
            Pickleball open play OS
          </p>
          <h1 className="max-w-xl text-5xl font-semibold leading-[1.05] tracking-tight text-[var(--ink)] md:text-6xl">
            Run open play without the whiteboard.
          </h1>
          <p className="max-w-xl text-lg text-[var(--muted)]">
            Fair rotations and a live board for every court, on phones and the
            gym TV.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href={ctaHref}>{ctaLabel}</Link>
            </Button>
          </div>
        </div>

        <div className="animate-rise-delay animate-drift relative min-h-[360px] overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--ink)] p-6 text-[var(--paper)] shadow-2xl">
          <div className="board-shade absolute inset-0" />
          <div className="relative space-y-5">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--highlight)]">
              Court board
            </p>
            <div className="grid gap-3">
              {liveCourts.map((court, i) => (
                <div
                  key={court.court}
                  className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="mb-2 flex justify-between text-sm">
                    <span>{court.court}</span>
                    <span className="text-[var(--highlight)]">LIVE</span>
                  </div>
                  {[
                    [court.a, court.scoreA],
                    [court.b, court.scoreB],
                  ].map(([name, score]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between gap-3 py-0.5"
                    >
                      <span className="text-sm text-white/80">{name}</span>
                      <span className="font-[family-name:var(--font-display)] text-3xl leading-none tabular-nums text-[var(--highlight)]">
                        {score}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-t border-[var(--border)] bg-[var(--surface)]/70 py-16 backdrop-blur">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-3">
          {[
            {
              title: "Fair by default",
              body: "Fewest games and longest wait first, then minimize repeat partners and opponents.",
            },
            {
              title: "Everyone sees the board",
              body: "QR join for players, host console for organizers, full-bleed wallboard for the gym TV.",
            },
            {
              title: "Cloud sync",
              body: "Supabase realtime keeps phones and the host tablet in lockstep — no paddle rack required.",
            },
          ].map((item) => (
            <article key={item.title} className="space-y-2">
              <h2 className="font-[family-name:var(--font-display)] text-2xl">
                {item.title}
              </h2>
              <p className="text-[var(--muted)]">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative z-10 border-t border-[var(--border)] py-16">
        <div className="mx-auto max-w-6xl space-y-16 px-6">
          <div className="max-w-xl space-y-6">
            <p className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">
              Tournament mode
            </p>
            <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--ink)] md:text-5xl">
              Every category, on the courts you have
            </h2>
            <p className="text-lg text-[var(--muted)]">
              Divisions share the gym. Pools feed a bracket, umpires score from
              the court, and one public link stays open for everyone else.
            </p>
            <Button size="lg" asChild>
              <Link href={tournamentHref}>Run a tournament</Link>
            </Button>
          </div>

          <div className="space-y-16">
            {tournamentFeatures.map((feature, index) => (
              <article
                key={feature.title}
                className="grid items-center gap-8 md:grid-cols-2"
              >
                <div className={index % 2 === 1 ? "md:order-2" : undefined}>
                  <h3 className="font-[family-name:var(--font-display)] text-3xl">
                    {feature.title}
                  </h3>
                  <p className="mt-3 max-w-xl text-[var(--muted)]">
                    {feature.body}
                  </p>
                </div>
                <div className={index % 2 === 1 ? "md:order-1" : undefined}>
                  {feature.sample}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

const tournamentFeatures = [
  {
    title: "Categories share the courts",
    body: "Mixed, novice, and intermediate can all be in the gym at once. You choose which courts each category may use, so one division can be on court 1 while another is already playing on court 2.",
    sample: <SharedCourtsSample />,
  },
  {
    title: "Pools, then a bracket",
    body: "Teams play a pool first. The top finishers move on. If the next round is short a team, leave that spot as a bye, or fill it with a wild card: the best team that did not advance, ranked by wins and then point difference.",
    sample: <PoolSample />,
  },
  {
    title: "A score from the court",
    body: "Each umpire claims one court on their phone and enters only that match. A point on court 1 does not change the score on court 2. When the game ends, the result goes into the standings and, later, the bracket.",
    sample: <UmpireSample />,
  },
  {
    title: "A board anyone can open",
    body: "Share one link. Players, families, and the gym TV all watch the same page, with no account. Games on court, the live score, the standings, and the bracket stay current as umpires enter points.",
    sample: <PublicBoardSample />,
  },
];

function BoardPanel({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[1.75rem] bg-[var(--ink)] p-5 text-[var(--paper)] shadow-xl">
      <p className="mb-3 text-xs uppercase tracking-[0.3em] text-white/50">
        {label}
      </p>
      {children}
    </div>
  );
}

function ScoreRow({ name, score }: { name: string; score: number }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="text-sm text-white/80">{name}</span>
      <span className="font-[family-name:var(--font-display)] text-3xl leading-none tabular-nums text-[var(--highlight)]">
        {score}
      </span>
    </div>
  );
}

function SharedCourtsSample() {
  const courts = [
    {
      court: "Court 1",
      meta: "Mixed · M1",
      a: "Smith / Crozier",
      b: "Touzel / Scotti",
      scoreA: 8,
      scoreB: 6,
    },
    {
      court: "Court 2",
      meta: "Womens Novice · M4",
      a: "Torres / Doris",
      b: "Curley / Yang",
      scoreA: 4,
      scoreB: 7,
    },
  ];

  return (
    <BoardPanel label="On court">
      <div className="grid gap-3">
        {courts.map((court) => (
          <article
            key={court.court}
            className="rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-[var(--highlight)]">{court.court}</span>
              <span className="truncate text-white/50">{court.meta}</span>
            </div>
            <ScoreRow name={court.a} score={court.scoreA} />
            <ScoreRow name={court.b} score={court.scoreB} />
          </article>
        ))}
      </div>
    </BoardPanel>
  );
}

function PoolSample() {
  const rows = [
    ["1", "Smith / Crozier", "3", "0", "+18"],
    ["2", "Dobson / Tibbett", "2", "1", "+6"],
    ["3", "Egure / Carrell", "1", "2", "−4"],
  ];

  return (
    <BoardPanel label="Bracket A">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.14em] text-white/40">
          <tr>
            <th className="py-2 font-medium" scope="col">
              Team
            </th>
            {["W", "L", "+/−"].map((heading) => (
              <th
                key={heading}
                className="py-2 text-right font-medium"
                scope="col"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[1]} className="border-t border-white/10">
              <td className="py-2">
                {row[0]}. {row[1]}
                {row[0] === "3" ? (
                  <span className="ml-2 text-xs uppercase tracking-[0.12em] text-white/50">
                    Wild card
                  </span>
                ) : null}
              </td>
              {row.slice(2).map((value) => (
                <td key={value} className="py-2 text-right tabular-nums">
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </BoardPanel>
  );
}

function UmpireSample() {
  return (
    <div className="mx-auto w-full max-w-sm rounded-[1.75rem] bg-[var(--ink)] p-5 text-[var(--paper)] shadow-xl">
      <p className="text-xs uppercase tracking-[0.22em] text-[var(--highlight)]">
        Umpire phone
      </p>
      <p className="font-[family-name:var(--font-display)] text-4xl">Court 1</p>
      <p className="mb-4 text-sm text-white/50">Mixed · Game 1 of 1 · to 11</p>
      <ScoreRow name="Smith / Crozier" score={8} />
      <ScoreRow name="Touzel / Scotti" score={6} />
      <p className="mt-4 text-sm text-white/50">Smith · 2nd server</p>
    </div>
  );
}

function PublicBoardSample() {
  const standings = [
    ["Smith / Crozier", "2", "0"],
    ["Dobson / Tibbett", "1", "1"],
    ["Egure / Carrell", "0", "2"],
  ];

  return (
    <BoardPanel label="Public scoreboard">
      <p className="mb-2 text-xs uppercase tracking-[0.2em] text-white/50">
        On court
      </p>
      <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <span className="text-[var(--highlight)]">Court 2</span>
          <span className="text-white/50">Womens Novice · M4</span>
        </div>
        <ScoreRow name="Torres / Doris" score={11} />
        <ScoreRow name="Curley / Yang" score={5} />
      </article>
      <p className="mt-4 mb-1 text-xs uppercase tracking-[0.2em] text-white/50">
        Womens Beginner · standings
      </p>
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.14em] text-white/40">
          <tr>
            <th className="py-2 font-medium" scope="col">
              Team
            </th>
            {["W", "L"].map((heading) => (
              <th
                key={heading}
                className="py-2 text-right font-medium"
                scope="col"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => (
            <tr key={row[0]} className="border-t border-white/10">
              <td className="py-2">{row[0]}</td>
              <td className="py-2 text-right tabular-nums text-[var(--highlight)]">
                {row[1]}
              </td>
              <td className="py-2 text-right tabular-nums text-white/60">
                {row[2]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-white/50">
        No account. Anyone with the link.
      </p>
    </BoardPanel>
  );
}
