import { PendingLink } from "@/components/pending-link";
import { Button } from "@/components/ui/button";
import {
  CLUB_MONTHLY_PHP,
  formatPeso,
  TOURNAMENT_DAY_PHP,
  TOURNAMENT_VOLUME_DAY_PHP,
  TOURNAMENT_VOLUME_MIN_DAYS,
  TRIAL_DAYS,
} from "@/lib/entitlements";

export function PricingSection({
  ctaHref,
  ctaLabel,
}: {
  ctaHref: string;
  ctaLabel: string;
}) {
  const clubPrice = formatPeso(CLUB_MONTHLY_PHP);
  const dayPrice = formatPeso(TOURNAMENT_DAY_PHP);
  const volumePrice = formatPeso(TOURNAMENT_VOLUME_DAY_PHP);

  return (
    <section id="pricing" className="border-t border-[var(--border)] py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-xl space-y-4">
          <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--foreground)] md:text-5xl">
            Pricing
          </h2>
          <p className="text-lg text-[var(--muted)]">
            Open play and booking start with a {TRIAL_DAYS}-day trial. A club
            month and tournament days are separate, and neither renews on its
            own. Players are not billed.
          </p>
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          <article className="flex flex-col rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
              Trial
            </p>
            <p className="mt-3 font-[family-name:var(--font-display)] text-4xl text-[var(--foreground)]">
              {TRIAL_DAYS} days
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Open play and booking
            </p>
            <ul className="mt-4 space-y-2 text-sm text-[var(--foreground)]">
              <li>Host console and the live queue</li>
              <li>Court and coaching requests</li>
              <li>Tournament mode is separate</li>
            </ul>
          </article>
          <article className="flex flex-col rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
              Club
            </p>
            <p className="mt-3 font-[family-name:var(--font-display)] text-4xl text-[var(--foreground)]">
              {clubPrice}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              One month of open play and booking
            </p>
            <ul className="mt-4 space-y-2 text-sm text-[var(--foreground)]">
              <li>Host console and the live queue</li>
              <li>Court and coaching bookings</li>
              <li>Paying early adds another month</li>
            </ul>
          </article>
          <article className="flex flex-col rounded-[1.5rem] border border-[var(--highlight)]/40 bg-[var(--surface)] p-5">
            <p className="text-xs font-medium tracking-wide text-[var(--highlight)] uppercase">
              Tournament
            </p>
            <p className="mt-3 font-[family-name:var(--font-display)] text-4xl text-[var(--foreground)]">
              {dayPrice}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {dayPrice} a day for up to 3 days. {volumePrice} a day from{" "}
              {TOURNAMENT_VOLUME_MIN_DAYS} days. Pick the dates. They do not
              have to be in a row.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-[var(--foreground)]">
              <li>Buy it with or without a club month</li>
              <li>Only the dates you pick are open</li>
              <li>The public scoreboard stays open</li>
            </ul>
          </article>
        </div>
        <div className="mt-8">
          <Button size="lg" className="rounded-full" asChild>
            <PendingLink href={ctaHref}>{ctaLabel}</PendingLink>
          </Button>
        </div>
      </div>
    </section>
  );
}
