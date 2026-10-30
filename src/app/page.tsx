import type { ReactNode } from "react";
import Image from "next/image";
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

  return (
    <main className="page-canvas">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="brand-mark" role="img" aria-label={PRODUCT_NAME} />
        <Button asChild>
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      </nav>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-8 md:grid-cols-[1.05fr_0.95fr] md:pt-14">
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

        <Image
          src="/assets/open-play-wallboard.jpg"
          alt="Players on the sideline watching the open play board on a gym TV, with courts and the queue behind them."
          width={2528}
          height={1684}
          priority
          sizes="(min-width: 768px) 42vw, 100vw"
          className="animate-rise-delay h-auto w-full rounded-[1.75rem] object-cover shadow-[0_28px_70px_-36px_rgba(20,33,15,0.55)]"
        />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-8">
        <div className="grid gap-10 border-t border-[var(--border)] pt-12 md:grid-cols-3">
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
          ].map((item, index) => (
            <article key={item.title} className="space-y-2">
              <p className="text-xs tabular-nums tracking-[0.22em] text-[var(--accent)]">
                0{index + 1}
              </p>
              <h2 className="font-[family-name:var(--font-display)] text-2xl">
                {item.title}
              </h2>
              <p className="max-w-sm text-[var(--muted)]">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-6xl space-y-24 px-6">
          <div className="grid items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
            <div className="max-w-xl space-y-6">
              <p className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">
                Tournament mode
              </p>
              <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--ink)] md:text-5xl">
                Every category, on the courts you have
              </h2>
              <p className="text-lg text-[var(--muted)]">
                Divisions share the gym. Pools feed a bracket, umpires score
                from the court, and one public link stays open for everyone
                else.
              </p>
              <Button size="lg" asChild>
                <Link href={tournamentHref}>Run a tournament</Link>
              </Button>
            </div>
            <Image
              src="/assets/tournament-gym-board.jpg"
              alt="A player checking the tournament on a phone while the same board, with live courts and brackets, is on the gym TV."
              width={2752}
              height={1536}
              sizes="(min-width: 768px) 42vw, 100vw"
              className="h-auto w-full rounded-[1.75rem] object-cover shadow-[0_28px_70px_-36px_rgba(20,33,15,0.55)]"
            />
          </div>

          <div className="space-y-24">
            {tournamentFeatures.map((feature, index) => (
              <article
                key={feature.title}
                className="grid items-center gap-10 md:grid-cols-2 md:gap-16"
              >
                <div className={index % 2 === 1 ? "md:order-2" : undefined}>
                  <p className="text-xs tabular-nums tracking-[0.22em] text-[var(--accent)]">
                    0{index + 1}
                  </p>
                  <h3 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
                    {feature.title}
                  </h3>
                  <p className="mt-3 max-w-md text-[var(--muted)]">
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

      <footer className="mx-auto flex max-w-6xl items-center justify-between border-t border-[var(--border)] px-6 py-8 text-sm text-[var(--muted)]">
        <span>{PRODUCT_NAME}</span>
        <span>Open play and tournaments</span>
      </footer>
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
    <Image
      src="/assets/tournament-umpire.jpg"
      alt="An umpire at the scorer's table tapping Point on a tablet, with court 1 playing behind them."
      width={1792}
      height={2400}
      sizes="(min-width: 768px) 28rem, 80vw"
      className="mx-auto h-auto w-full max-w-md rounded-[1.75rem] object-cover shadow-[0_28px_70px_-36px_rgba(20,33,15,0.55)]"
    />
  );
}

function PublicBoardSample() {
  return (
    <Image
      src="/assets/tournament-phone-board.jpg"
      alt="A phone in the gym showing the public tournament board, with the same board on the TV behind it."
      width={1792}
      height={2400}
      sizes="(min-width: 768px) 28rem, 80vw"
      className="mx-auto h-auto w-full max-w-md rounded-[1.75rem] object-cover shadow-[0_28px_70px_-36px_rgba(20,33,15,0.55)]"
    />
  );
}
