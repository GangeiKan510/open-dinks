import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PRODUCT_NAME } from "@/lib/facility";

export default function HomePage() {
  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(183,242,85,0.18),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(31,122,76,0.16),transparent_30%)]" />

      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="font-[family-name:var(--font-display)] text-2xl tracking-tight">
          {PRODUCT_NAME}
        </div>
        <Button asChild>
          <Link href="/login">Host login</Link>
        </Button>
      </nav>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-10 px-6 pb-20 pt-10 md:grid-cols-[1.1fr_0.9fr] md:items-center md:pt-16">
        <div className="animate-rise space-y-6">
          <p className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">
            Pickleball open play OS
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-5xl leading-[1.05] md:text-7xl">
            {PRODUCT_NAME}
          </h1>
          <p className="max-w-xl text-lg text-[var(--muted)]">
            Fair rotations. Live queues. Phone + TV wallboards. Run multi-court
            open play without the whiteboard chaos.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/login">Host login</Link>
            </Button>
          </div>
        </div>

        <div className="animate-rise-delay animate-drift relative min-h-[360px] overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--ink)] p-6 text-[var(--paper)] shadow-2xl">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(183,242,85,0.18),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(31,122,76,0.45),transparent_45%)]" />
          <div className="relative space-y-5">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--lime)]">
              Court board
            </p>
            <div className="grid gap-3">
              {["Court 1", "Court 2", "Court 3"].map((court, i) => (
                <div
                  key={court}
                  className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="mb-2 flex justify-between text-sm">
                    <span>{court}</span>
                    <span className="text-[var(--lime)]">LIVE</span>
                  </div>
                  <div className="text-sm text-white/80">
                    {i === 0 && "Alex & Blake vs Casey & Drew"}
                    {i === 1 && "Eden & Finley vs Gray & Harper"}
                    {i === 2 && "Indie & Jordan vs Kai & Logan"}
                  </div>
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
    </main>
  );
}
