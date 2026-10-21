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
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <p className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">
              Tournament mode
            </p>
            <h2 className="max-w-xl text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--ink)] md:text-5xl">
              Every category, on the courts you have
            </h2>
            <p className="max-w-xl text-lg text-[var(--muted)]">
              Pool play feeds a bracket. An umpire scores from the court, and
              the public board shows the live score to the gym.
            </p>
            <Button size="lg" asChild>
              <Link href={tournamentHref}>Run a tournament</Link>
            </Button>
          </div>
          <div className="grid gap-6">
            {[
              {
                title: "Categories share the courts",
                body: "Several divisions play at once. Each one uses the courts you assign, instead of waiting for its own gym.",
              },
              {
                title: "Pools, then a bracket",
                body: "Advance the top teams. When the draw is short of the next round, leave a bye or take a wild card by wins and point difference.",
              },
              {
                title: "A score from the court",
                body: "Each umpire updates their own match. Everyone else watches the live score, standings, bracket, sponsors, and club results.",
              },
            ].map((item) => (
              <article key={item.title} className="space-y-2">
                <h3 className="font-[family-name:var(--font-display)] text-2xl">
                  {item.title}
                </h3>
                <p className="text-[var(--muted)]">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
