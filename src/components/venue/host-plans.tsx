"use client";

import Link from "next/link";
import { createContext, useContext, useState, type ReactNode } from "react";
import { CalendarRange, Check, Clock, Crown, Lock, Trophy } from "lucide-react";
import {
  startClubCheckoutAction,
  startTournamentPassAction,
} from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CLUB_MONTHLY_PHP,
  formatPeso,
  formatTournamentDates,
  TOURNAMENT_DAY_PHP,
  TOURNAMENT_WEEKEND_PHP,
  type FeatureAccess,
} from "@/lib/entitlements";
import { cn } from "@/lib/utils";

type PlansContextValue = {
  openPlans: () => void;
  access: FeatureAccess;
  timeZone: string;
};

const PlansContext = createContext<PlansContextValue | null>(null);

function usePlans() {
  const value = useContext(PlansContext);
  if (!value)
    throw new Error("Plans controls must sit inside the plan provider");
  return value;
}

function formatWhen(value: string | null, timeZone: string): string {
  if (!value) return "";
  const date =
    value.length === 10 ? new Date(`${value}T00:00:00Z`) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: value.length === 10 ? "UTC" : timeZone,
  }).format(date);
}

export function PlansProvider({
  access,
  timeZone,
  today,
  notice,
  defaultOpen,
  children,
}: {
  access: FeatureAccess;
  timeZone: string;
  today: string;
  notice: string | null;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <PlansContext.Provider
      value={{ openPlans: () => setOpen(true), access, timeZone }}
    >
      {children}
      <PlansDialog
        open={open}
        onOpenChange={setOpen}
        access={access}
        timeZone={timeZone}
        today={today}
        notice={notice}
      />
    </PlansContext.Provider>
  );
}

export function AvailableTournamentLink() {
  return (
    <Button asChild>
      <Link href="/tournament">
        <Trophy className="h-4 w-4 shrink-0" aria-hidden />
        Tournament mode
      </Link>
    </Button>
  );
}

export function TournamentModeButton() {
  const { access, openPlans } = usePlans();

  if (access.tournament) {
    return <AvailableTournamentLink />;
  }

  return (
    <button
      type="button"
      onClick={openPlans}
      aria-haspopup="dialog"
      className="inline-flex h-10 items-center gap-2 rounded-md border border-amber-400/40 bg-amber-400/10 px-3 text-sm font-medium text-amber-100 transition-colors hover:bg-amber-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
    >
      <Lock className="h-4 w-4 shrink-0" aria-hidden />
      Tournament mode
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-300 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950">
        <Crown className="h-3 w-3" aria-hidden />
        Premium
      </span>
    </button>
  );
}

function PlanChip({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex h-6 items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 text-xs font-semibold uppercase tracking-[0.14em]">
        {label}
      </span>
      <span className="text-sm">{detail}</span>
    </div>
  );
}

function tournamentDetail(access: FeatureAccess): string {
  return formatTournamentDates(
    access.tournamentStartsOn,
    access.tournamentThrough,
  );
}

export function PlanSummary() {
  const { access, openPlans, timeZone } = usePlans();
  const clubPrice = formatPeso(CLUB_MONTHLY_PHP);
  const daysLabel = access.trialDaysLeft === 1 ? "day" : "days";
  const tournamentDates = tournamentDetail(access);
  const clubExpiry = formatWhen(access.clubPeriodEnd, timeZone);

  if (access.phase === "trial") {
    return (
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-300/70 bg-[linear-gradient(105deg,rgba(251,191,36,0.22),rgba(251,191,36,0.06))] px-4 py-4 shadow-[0_0_32px_-16px_rgba(251,191,36,0.9)]">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-300 text-amber-950">
            <Clock className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
              Free trial
            </p>
            <p className="text-lg font-semibold text-amber-50">
              {access.trialDaysLeft} {daysLabel} left
            </p>
            <p className="mt-0.5 max-w-xl text-sm text-amber-100/85">
              Open play and booking stop when the trial ends. Upgrade for{" "}
              {clubPrice} a month to keep them.
            </p>
            {tournamentDates ? (
              <div className="mt-3">
                <PlanChip label="Tournament" detail={tournamentDates} />
              </div>
            ) : null}
          </div>
        </div>
        <Button type="button" onClick={openPlans}>
          Upgrade plan
        </Button>
      </section>
    );
  }

  const subscribed = access.clubPaid || Boolean(tournamentDates);

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
        {subscribed ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--highlight)]">
            <Check className="h-4 w-4 shrink-0" aria-hidden />
            Subscribed
          </span>
        ) : null}
        {access.clubPaid ? (
          <PlanChip
            label="Club"
            detail={clubExpiry ? `through ${clubExpiry}` : "Active"}
          />
        ) : null}
        {tournamentDates ? (
          <PlanChip label="Tournament" detail={tournamentDates} />
        ) : null}
        {!access.clubPaid && !access.tournament ? (
          <p className="text-sm font-medium">Club plan paused</p>
        ) : null}
      </div>
      <Button type="button" variant="outline" onClick={openPlans}>
        {access.phase === "locked" ? "Upgrade plan" : "Compare plans"}
      </Button>
    </section>
  );
}

export function OpenPlansButton({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { openPlans } = usePlans();
  return (
    <Button type="button" className={className} onClick={openPlans}>
      {children}
    </Button>
  );
}

function PlansDialog({
  open,
  onOpenChange,
  access,
  timeZone,
  today,
  notice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  access: FeatureAccess;
  timeZone: string;
  today: string;
  notice: string | null;
}) {
  const clubPrice = formatPeso(CLUB_MONTHLY_PHP);
  const dayPrice = formatPeso(TOURNAMENT_DAY_PHP);
  const weekendPrice = formatPeso(TOURNAMENT_WEEKEND_PHP);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-[family-name:var(--font-display)] text-2xl">
            Plans
          </DialogTitle>
          <DialogDescription>
            Pay for open play, tournament days, or both. Each one stands on its
            own.
          </DialogDescription>
        </DialogHeader>

        {notice ? (
          <p className="text-sm text-amber-300" role="status">
            {notice}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <article className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
              Club
            </p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-3xl">
              {clubPrice}
            </p>
            <p className="text-sm text-[var(--muted)]">for 1 month</p>
            <ul className="mt-4 space-y-1.5 text-sm">
              <li>Open play and the host console</li>
              <li>Court and coaching bookings</li>
              <li>Paying early adds another month</li>
            </ul>
            <form action={startClubCheckoutAction} className="mt-auto pt-4">
              <Button type="submit" className="w-full">
                {access.clubPaid ? "Add 1 month" : "Pay for 1 month"}
              </Button>
            </form>
          </article>

          <article
            className={cn(
              "flex flex-col rounded-xl border p-4",
              "border-amber-400/40 bg-amber-400/10",
            )}
          >
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
              <Crown className="h-3.5 w-3.5" aria-hidden />
              Premium
            </p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-3xl">
              Tournament
            </p>
            <p className="text-sm text-amber-100/80">
              For tournament days only. Open play and booking stay on the club
              month.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-start justify-between gap-3">
                <span className="inline-flex items-center gap-2">
                  <Trophy
                    className="h-4 w-4 shrink-0 text-amber-200"
                    aria-hidden
                  />
                  One tournament day
                </span>
                <span className="font-medium">{dayPrice}</span>
              </li>
              <li className="flex items-start justify-between gap-3">
                <span className="inline-flex items-center gap-2">
                  <CalendarRange
                    className="h-4 w-4 shrink-0 text-amber-200"
                    aria-hidden
                  />
                  Four days in a row
                </span>
                <span className="font-medium">{weekendPrice}</span>
              </li>
            </ul>

            <form action={startTournamentPassAction} className="mt-4 space-y-3">
              <div className="space-y-1">
                <label
                  htmlFor="tournament-starts-on"
                  className="text-sm text-amber-100/80"
                >
                  First tournament day
                </label>
                <input
                  id="tournament-starts-on"
                  name="startsOn"
                  type="date"
                  required
                  min={today}
                  defaultValue={today}
                  className="block w-full rounded-md border border-amber-200/30 bg-black/20 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Button type="submit" name="kind" value="day">
                  Buy 1 day
                </Button>
                <Button
                  type="submit"
                  name="kind"
                  value="weekend"
                  variant="outline"
                >
                  Buy 4 days
                </Button>
              </div>
            </form>

            {access.tournament && access.tournamentThrough ? (
              <p className="mt-3 text-sm">
                Open through {formatWhen(access.tournamentThrough, timeZone)}.
              </p>
            ) : null}
          </article>
        </div>
      </DialogContent>
    </Dialog>
  );
}
