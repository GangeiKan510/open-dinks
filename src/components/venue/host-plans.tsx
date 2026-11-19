"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  Lock,
  Trophy,
  X,
} from "lucide-react";
import {
  previewDiscountAction,
  startClubCheckoutAction,
  startTournamentPassAction,
  startTrialAction,
} from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SignOutButton } from "@/components/venue/sign-out-button";
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
  formatTournamentDateList,
  formatTournamentDates,
  TOURNAMENT_DAY_PHP,
  TOURNAMENT_MAX_DAYS,
  TOURNAMENT_VOLUME_DAY_PHP,
  TOURNAMENT_VOLUME_MIN_DAYS,
  TRIAL_DAYS,
  tournamentDatesPriceCentavos,
  tournamentDayRatePhp,
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
  statusNotice,
  defaultOpen,
  children,
}: {
  access: FeatureAccess;
  timeZone: string;
  today: string;
  notice: string | null;
  statusNotice: string | null;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <PlansContext.Provider
      value={{ openPlans: () => setOpen(true), access, timeZone }}
    >
      {children}
      {access.awaitingPlanChoice ? (
        <PlanChoiceDialog today={today} notice={statusNotice} />
      ) : (
        <PlansDialog
          open={open}
          onOpenChange={setOpen}
          access={access}
          today={today}
          notice={notice}
        />
      )}
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

  if (access.tournamentSetup) {
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
  if (access.tournamentGrace && access.tournamentThrough) {
    return `${formatTournamentDates(access.tournamentThrough, access.tournamentThrough)} · until 6:00 AM`;
  }
  return formatTournamentDateList(access.ownedTournamentDates);
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

function PlanChoiceDialog({
  today,
  notice,
}: {
  today: string;
  notice: string | null;
}) {
  const clubPrice = formatPeso(CLUB_MONTHLY_PHP);

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        className="max-w-4xl"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="pr-0">
          <DialogTitle className="font-[family-name:var(--font-display)] text-2xl">
            Choose how to open your club
          </DialogTitle>
          <DialogDescription>
            Pick one to continue. A {TRIAL_DAYS}-day trial or a club month opens
            open play and booking. Tournament days are separate.
          </DialogDescription>
        </DialogHeader>

        {notice ? (
          <p className="text-sm text-amber-300" role="alert">
            {notice}
          </p>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-3">
          <article className="flex flex-col rounded-xl border border-[var(--accent)]/70 bg-[linear-gradient(165deg,var(--accent-soft),var(--surface))] p-4">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-fg-soft)]">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              Free trial
            </p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[var(--accent-fg-soft)]">
              {TRIAL_DAYS} days
            </p>
            <p className="text-sm text-[var(--accent-fg-soft)]">
              Open play and booking
            </p>
            <ul className="mt-4 space-y-1.5 text-sm">
              <li>Host console and the public session page</li>
              <li>Court and coaching bookings</li>
              <li>Tournament mode stays locked</li>
            </ul>
            <form action={startTrialAction} className="mt-auto pt-4">
              <Button
                type="submit"
                variant="outline"
                size="lg"
                className="w-full border-[var(--accent)] text-[var(--accent-fg-soft)] hover:bg-[var(--accent-soft)]"
              >
                <Clock className="h-4 w-4" aria-hidden />
                Start trial
              </Button>
            </form>
          </article>

          <article className="flex flex-col rounded-xl border border-[var(--highlight)]/70 bg-[linear-gradient(165deg,var(--accent-soft),var(--surface))] p-4 shadow-[0_0_32px_-18px_var(--highlight)]">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--highlight)]">
              <Check className="h-3.5 w-3.5" aria-hidden />
              Club
            </p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[var(--highlight)]">
              {clubPrice}
            </p>
            <p className="text-sm text-[var(--accent-fg-soft)]">for 1 month</p>
            <ul className="mt-4 space-y-1.5 text-sm">
              <li>Open play and the host console</li>
              <li>Court and coaching bookings</li>
              <li>Paying early adds another month</li>
            </ul>
            <ClubPayForm
              label="Pay for 1 month"
              className="bg-[var(--highlight)] text-[var(--ink)] hover:bg-[var(--accent-fg-soft)]"
            />
          </article>

          <article className="flex flex-col rounded-xl border border-amber-300/80 bg-[linear-gradient(165deg,rgba(251,191,36,0.22),var(--surface))] p-4 shadow-[0_0_32px_-18px_#fbbf24]">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
              <Crown className="h-3.5 w-3.5" aria-hidden />
              Tournament
            </p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-3xl text-amber-200">
              {formatPeso(TOURNAMENT_DAY_PHP)}
            </p>
            <p className="text-sm text-amber-100/80">
              A day. {formatPeso(TOURNAMENT_VOLUME_DAY_PHP)} a day from{" "}
              {TOURNAMENT_VOLUME_MIN_DAYS} days. Open play stays locked until
              you start a trial or a club month.
            </p>
            <TournamentDatesForm today={today} />
          </article>
        </div>

        <div className="flex justify-end">
          <SignOutButton />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlansDialog({
  open,
  onOpenChange,
  access,
  today,
  notice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  access: FeatureAccess;
  today: string;
  notice: string | null;
}) {
  const clubPrice = formatPeso(CLUB_MONTHLY_PHP);

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
            {access.clubTrialAvailable ? (
              <form action={startTrialAction} className="mt-auto pt-4">
                <Button
                  type="submit"
                  variant="outline"
                  size="lg"
                  className="w-full border-[var(--accent)] text-[var(--accent-fg-soft)] hover:bg-[var(--accent-soft)]"
                >
                  <Clock className="h-4 w-4" aria-hidden />
                  Start {TRIAL_DAYS}-day trial
                </Button>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Open play and booking for {TRIAL_DAYS} days. Tournament days
                  stay separate.
                </p>
              </form>
            ) : null}
            <ClubPayForm
              label={access.clubPaid ? "Add 1 month" : "Pay for 1 month"}
            />
          </article>

          <article className="flex flex-col rounded-xl border border-amber-300/80 bg-[linear-gradient(165deg,rgba(251,191,36,0.22),var(--surface))] p-4 shadow-[0_0_32px_-18px_#fbbf24]">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
              <Crown className="h-3.5 w-3.5" aria-hidden />
              Premium
            </p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-3xl text-amber-200">
              Tournament
            </p>
            <p className="text-sm text-amber-100/80">
              For tournament days only. Open play and booking stay on the club
              month.
            </p>
            <p className="mt-3 text-sm text-amber-100/80">
              {formatPeso(TOURNAMENT_DAY_PHP)} a day for up to 3 days.{" "}
              {formatPeso(TOURNAMENT_VOLUME_DAY_PHP)} a day from{" "}
              {TOURNAMENT_VOLUME_MIN_DAYS} days. Pick the dates you need.
            </p>
            <TournamentDatesForm today={today} />

            {access.tournamentGrace ? (
              <p className="mt-3 text-sm">Open until 6:00 AM.</p>
            ) : access.ownedTournamentDates.length > 0 ? (
              <p className="mt-3 text-sm">
                Paid for {formatTournamentDateList(access.ownedTournamentDates)}
                . Brackets open on those days.
              </p>
            ) : null}
          </article>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ClubPayForm({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <form action={startClubCheckoutAction} className="mt-auto space-y-3 pt-4">
      <DiscountCodeFields id="discount-club" product="club" dates="" />
      <Button type="submit" size="lg" className={cn("w-full", className)}>
        {label}
      </Button>
    </form>
  );
}

function DiscountCodeFields({
  id,
  product,
  dates,
}: {
  id: string;
  product: "club" | "day";
  dates: string;
}) {
  const [code, setCode] = useState("");
  const [quote, setQuote] = useState<{ key: string; summary: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const quoteKey = `${product}:${dates}:${code.trim().toUpperCase()}`;
  const summary = quote?.key === quoteKey ? quote.summary : null;

  function applyCode() {
    setError(null);
    const current = quoteKey;
    startTransition(async () => {
      const result = await previewDiscountAction({ product, dates, code });
      if (!result.ok) {
        setQuote(null);
        setError(result.message);
        return;
      }
      setQuote({ key: current, summary: result.summary });
    });
  }

  return (
    <div className="space-y-1">
      <input type="hidden" name="discount_code" value={code} />
      <label htmlFor={id} className="text-sm text-[var(--foreground)]">
        Discount code
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={code}
          autoComplete="off"
          maxLength={24}
          placeholder="e.g. EARLY"
          onChange={(event) => {
            setCode(event.target.value);
            setError(null);
          }}
          className="bg-black/20"
        />
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          disabled={pending || code.trim().length === 0}
          onClick={applyCode}
        >
          Apply
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-amber-200" role="alert">
          {error}
        </p>
      ) : null}
      {summary ? (
        <p className="text-sm" role="status">
          {summary}
        </p>
      ) : null}
    </div>
  );
}

function TournamentDatesForm({ today }: { today: string }) {
  const { access } = usePlans();
  const ownedDates = access.ownedTournamentDates;
  const [dates, setDates] = useState<string[]>([]);
  const totalCentavos = tournamentDatesPriceCentavos(dates);
  const total = totalCentavos == null ? null : totalCentavos / 100;
  const rate = dates.length === 0 ? null : tournamentDayRatePhp(dates.length);

  function toggleDate(iso: string) {
    setDates((current) => {
      if (ownedDates.includes(iso)) return current;
      if (current.includes(iso)) return current.filter((item) => item !== iso);
      if (iso < today || current.length >= TOURNAMENT_MAX_DAYS) return current;
      return [...current, iso].sort();
    });
  }

  return (
    <form action={startTournamentPassAction} className="mt-4 space-y-3">
      <input type="hidden" name="dates" value={dates.join(",")} />
      <div className="space-y-1">
        <label htmlFor="tournament-day" className="text-sm text-amber-100/80">
          Tournament days
        </label>
        <TournamentDateField
          id="tournament-day"
          today={today}
          dates={dates}
          ownedDates={ownedDates}
          onToggle={toggleDate}
        />
      </div>
      {dates.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {dates.map((date) => (
            <li key={date}>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-amber-300/50 bg-black/20 px-2.5 py-1 text-xs text-amber-50"
                onClick={() => toggleDate(date)}
              >
                {formatTournamentDates(date, date)}
                <X className="h-3 w-3" aria-hidden />
                <span className="sr-only">Remove {date}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-amber-100/70">
          Tap each day. They do not have to be in a row. Up to{" "}
          {TOURNAMENT_MAX_DAYS} days.
        </p>
      )}
      <DiscountCodeFields
        id="discount-day"
        product="day"
        dates={dates.join(",")}
      />
      <Button
        type="submit"
        size="lg"
        className="w-full bg-amber-300 text-amber-950 hover:bg-amber-200"
        disabled={dates.length === 0}
      >
        <Trophy className="h-4 w-4" aria-hidden />
        {total == null || rate == null
          ? "Pay for these days"
          : `Pay ${formatPeso(total)} · ${dates.length} ${dates.length === 1 ? "day" : "days"} at ${formatPeso(rate)}`}
      </Button>
    </form>
  );
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(Date.UTC(year!, monthIndex! - 1 + delta, 1))
    .toISOString()
    .slice(0, 7);
}

function monthLabel(month: string): string {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year!, monthIndex! - 1, 1)));
}

function leadingBlanks(month: string): number {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(Date.UTC(year!, monthIndex! - 1, 1)).getUTCDay();
}

function daysInMonth(month: string): number {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(Date.UTC(year!, monthIndex!, 0)).getUTCDate();
}

function fieldLabel(dates: string[]): string {
  if (dates.length === 0) return "Select days";
  if (dates.length === 1) return formatTournamentDates(dates[0]!, dates[0]!);
  return `${dates.length} days`;
}

function TournamentDateField({
  id,
  today,
  dates,
  ownedDates,
  onToggle,
}: {
  id: string;
  today: string;
  dates: string[];
  ownedDates: string[];
  onToggle: (iso: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => monthOf(today));
  const [box, setBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const atCap = dates.length >= TOURNAMENT_MAX_DAYS;

  useLayoutEffect(() => {
    if (!open) return;
    const anchor = rootRef.current;
    if (!anchor) return;

    function place() {
      const rect = anchor!.getBoundingClientRect();
      const estimated = 348;
      const gap = 8;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const spaceAbove = rect.top - gap;
      const openUp = spaceBelow < estimated && spaceAbove > spaceBelow;
      setBox({
        top: openUp
          ? Math.max(8, rect.top - gap - estimated)
          : rect.bottom + gap,
        left: rect.left,
        width: rect.width,
      });
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, month]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const blanks = leadingBlanks(month);
  const dayCount = daysInMonth(month);
  const label = fieldLabel(dates);
  const calendar =
    open && box
      ? createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={`Choose tournament days, ${monthLabel(month)}`}
            style={{
              position: "fixed",
              top: box.top,
              left: box.left,
              width: box.width,
              pointerEvents: "auto",
              zIndex: 70,
            }}
            className="rounded-xl border border-white/10 bg-[var(--surface)] p-3 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.85)]"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-[family-name:var(--font-display)] text-base">
                {monthLabel(month)}
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label="Previous month"
                  disabled={month <= monthOf(today)}
                  onClick={() => setMonth((current) => shiftMonth(current, -1))}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--foreground)] hover:bg-white/10 disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => setMonth((current) => shiftMonth(current, 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--foreground)] hover:bg-white/10"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 text-center text-[10px] font-medium tracking-[0.14em] text-[var(--muted)] uppercase">
              {WEEKDAYS.map((weekday) => (
                <span key={weekday} className="py-1">
                  {weekday}
                </span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-y-1">
              {Array.from({ length: blanks }, (_, index) => (
                <span key={`blank-${index}`} />
              ))}
              {Array.from({ length: dayCount }, (_, index) => {
                const day = index + 1;
                const iso = `${month}-${String(day).padStart(2, "0")}`;
                const paid = ownedDates.includes(iso);
                const selected = !paid && dates.includes(iso);
                const disabled = iso < today || paid || (atCap && !selected);
                const dayLabel = formatTournamentDates(iso, iso);
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={disabled}
                    aria-pressed={selected}
                    aria-label={
                      paid
                        ? `Already paid ${dayLabel}`
                        : selected
                          ? `Remove ${dayLabel}`
                          : `Add ${dayLabel}`
                    }
                    onClick={() => onToggle(iso)}
                    className={cn(
                      "mx-auto flex aspect-square w-full max-w-9 items-center justify-center rounded-full text-sm transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200",
                      "disabled:cursor-not-allowed disabled:text-white/25",
                      paid &&
                        "disabled:bg-white/10 disabled:text-white/45 disabled:line-through",
                      !disabled && !selected && "hover:bg-amber-400/15",
                      iso === today &&
                        !selected &&
                        "ring-1 ring-inset ring-amber-300/80",
                      selected && "bg-amber-300 font-semibold text-amber-950",
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-center text-xs text-amber-100/70">
              {dates.length === 0
                ? "Tap a day to add it. Tap it again to remove it."
                : `${dates.length} ${dates.length === 1 ? "day" : "days"} at ${formatPeso(tournamentDayRatePhp(dates.length))}`}
            </p>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef}>
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setMonth(monthOf(dates[0] ?? today));
          setOpen((current) => !current);
        }}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-md border bg-black/20 px-3 text-left text-sm",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200",
          open ? "border-amber-300" : "border-amber-200/30",
          dates.length === 0 ? "text-amber-100/60" : "text-amber-50",
        )}
      >
        <span className="truncate">{label}</span>
        <Calendar className="h-4 w-4 shrink-0 text-amber-100/80" aria-hidden />
      </button>
      {calendar}
    </div>
  );
}
