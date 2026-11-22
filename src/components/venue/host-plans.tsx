"use client";

import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
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
  submitClubProofAction,
  submitTournamentProofAction,
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
  BILLING_ERROR_MESSAGES,
  receiptSentCopy,
} from "@/lib/billing-messages";
import { formatCheckoutPesos } from "@/lib/discounts";
import {
  CLUB_MONTHLY_PHP,
  CLUB_PRICE_CENTAVOS,
  formatPeso,
  formatTournamentDateList,
  formatTournamentDates,
  TOURNAMENT_DAY_PHP,
  TOURNAMENT_MAX_DAYS,
  TRIAL_DAYS,
  tournamentDatesPriceCentavos,
  tournamentDayRatePhp,
  type FeatureAccess,
} from "@/lib/entitlements";
import { cn } from "@/lib/utils";
import { collectsManualPayments } from "@/lib/payments-mode";
import {
  formatGcashNumber,
  proofRejection,
  proofWaiting,
  type HostProof,
} from "@/lib/payment-proof";

type PlansContextValue = {
  openPlans: () => void;
  access: FeatureAccess;
  timeZone: string;
  gcash: { number: string; name: string } | null;
  proofs: HostProof[];
};

const PlansContext = createContext<PlansContextValue | null>(null);

type FormBusyValue = {
  active: boolean;
  mark: (id: string, pending: boolean) => void;
};

const FormBusyContext = createContext<FormBusyValue | null>(null);

function FormBusyProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set());
  const mark = useCallback((id: string, pending: boolean) => {
    setIds((current) => {
      if (pending === current.has(id)) return current;
      const next = new Set(current);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const value = useMemo(() => ({ active: ids.size > 0, mark }), [ids, mark]);

  return (
    <FormBusyContext.Provider value={value}>
      {children}
    </FormBusyContext.Provider>
  );
}

function PendingSubmit({
  busyId,
  children,
  disabled,
  className,
  variant,
}: {
  busyId: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
  variant?: "default" | "outline";
}) {
  const { pending } = useFormStatus();
  const busy = useContext(FormBusyContext);
  const mark = busy?.mark;
  useEffect(() => {
    mark?.(busyId, pending);
    return () => mark?.(busyId, false);
  }, [mark, busyId, pending]);

  return (
    <Button
      type="submit"
      size="lg"
      variant={variant}
      className={cn("w-full", className)}
      loading={pending}
      disabled={disabled || (Boolean(busy?.active) && !pending)}
    >
      {children}
    </Button>
  );
}

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
  gcash = null,
  proofs = [],
  children,
}: {
  access: FeatureAccess;
  timeZone: string;
  today: string;
  notice: string | null;
  statusNotice: string | null;
  defaultOpen: boolean;
  gcash?: { number: string; name: string } | null;
  proofs?: HostProof[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const pendingReceipt = proofs.some((proof) => proof.status === "pending");
  const hadPendingReceipt = useRef(pendingReceipt);
  const receiptSent = statusNotice === BILLING_ERROR_MESSAGES.proof;
  const [trackedReceipt, setTrackedReceipt] = useState(receiptSent);
  if (receiptSent !== trackedReceipt) {
    setTrackedReceipt(receiptSent);
    if (receiptSent && !access.awaitingPlanChoice) setOpen(false);
  }

  useEffect(() => {
    if (hadPendingReceipt.current && !pendingReceipt) setOpen(false);
    hadPendingReceipt.current = pendingReceipt;
  }, [pendingReceipt]);

  return (
    <PlansContext.Provider
      value={{
        openPlans: () => setOpen(true),
        access,
        timeZone,
        gcash,
        proofs,
      }}
    >
      {children}
      {access.awaitingPlanChoice ? (
        <PlanChoiceDialog
          today={today}
          notice={receiptSent ? null : statusNotice}
          receiptSent={receiptSent}
        />
      ) : (
        <PlansDialog
          open={open && !receiptSent}
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
  receiptSent,
}: {
  today: string;
  notice: string | null;
  receiptSent: boolean;
}) {
  const clubPrice = formatPeso(CLUB_MONTHLY_PHP);
  const [checkout, setCheckout] = useState<CheckoutKind | null>(null);
  const sent = receiptSent && checkout != null;
  const heading =
    checkout && receiptSent
      ? { title: "Payment sent", detail: receiptSentCopy(checkout) }
      : checkoutHeading(checkout, {
          plans: "Choose how to open your club",
          plansDetail: `Pick one to continue. A ${TRIAL_DAYS}-day trial or a club month opens open play and booking. Tournament days are separate.`,
        });

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        className={sent ? "max-w-md" : "max-w-4xl"}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        {sent ? <PaymentSentMark /> : null}
        <DialogHeader
          className={sent ? "items-center px-6 pr-6 text-center" : "pr-0"}
        >
          <DialogTitle className="font-[family-name:var(--font-display)] text-2xl">
            {heading.title}
          </DialogTitle>
          <DialogDescription
            className={sent ? "text-base text-[var(--foreground)]" : undefined}
          >
            {heading.detail}
          </DialogDescription>
        </DialogHeader>

        <FormBusyProvider>
          {notice ? (
            <p className="text-sm text-amber-300" role="alert">
              {notice}
            </p>
          ) : null}

          {sent ? null : checkout ? (
            <CheckoutPanel
              kind={checkout}
              today={today}
              clubClassName="bg-[var(--highlight)] text-[var(--ink)] hover:bg-[var(--accent-fg-soft)]"
              onBack={() => setCheckout(null)}
            />
          ) : (
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
                  <PendingSubmit
                    busyId="trial"
                    variant="outline"
                    className="border-[var(--accent)] text-[var(--accent-fg-soft)] hover:bg-[var(--accent-soft)]"
                  >
                    <Clock className="h-4 w-4" aria-hidden />
                    Start trial
                  </PendingSubmit>
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
                <p className="text-sm text-[var(--accent-fg-soft)]">
                  for 1 month
                </p>
                <ul className="mt-4 space-y-1.5 text-sm">
                  <li>Open play and the host console</li>
                  <li>Court and coaching bookings</li>
                  <li>Paying early adds another month</li>
                </ul>
                <PlanContinue
                  kind="club"
                  label="Continue"
                  className="bg-[var(--highlight)] text-[var(--ink)] hover:bg-[var(--accent-fg-soft)]"
                  onClick={() => setCheckout("club")}
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
                  A day. Open play stays locked until you start a trial or a
                  club month.
                </p>
                <PlanContinue
                  kind="day"
                  label="Choose days"
                  icon={<Trophy className="h-4 w-4" aria-hidden />}
                  className="bg-amber-300 text-amber-950 hover:bg-amber-200"
                  onClick={() => setCheckout("day")}
                />
              </article>
            </div>
          )}

          <div className="flex justify-end">
            <SignOutButton />
          </div>
        </FormBusyProvider>
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
  const [checkout, setCheckout] = useState<CheckoutKind | null>(null);
  const [trackedOpen, setTrackedOpen] = useState(open);
  if (open !== trackedOpen) {
    setTrackedOpen(open);
    if (!open) setCheckout(null);
  }
  const heading = checkoutHeading(checkout, {
    plans: "Plans",
    plansDetail: "Open play and tournament days are separate.",
  });

  function handleOpenChange(next: boolean) {
    if (!next) setCheckout(null);
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-[family-name:var(--font-display)] text-2xl">
            {heading.title}
          </DialogTitle>
          <DialogDescription>{heading.detail}</DialogDescription>
        </DialogHeader>

        <FormBusyProvider>
          {notice ? (
            <p className="text-sm text-amber-300" role="status">
              {notice}
            </p>
          ) : null}

          {checkout ? (
            <CheckoutPanel
              kind={checkout}
              today={today}
              onBack={() => setCheckout(null)}
            />
          ) : (
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
                  <form action={startTrialAction} className="pt-4">
                    <PendingSubmit
                      busyId="trial"
                      variant="outline"
                      className="border-[var(--accent)] text-[var(--accent-fg-soft)] hover:bg-[var(--accent-soft)]"
                    >
                      <Clock className="h-4 w-4" aria-hidden />
                      Start {TRIAL_DAYS}-day trial
                    </PendingSubmit>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Open play and booking for {TRIAL_DAYS} days. Tournament
                      days stay separate.
                    </p>
                  </form>
                ) : null}
                <PlanContinue
                  kind="club"
                  label={access.clubPaid ? "Add 1 month" : "Continue"}
                  onClick={() => setCheckout("club")}
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
                  For tournament days only. Open play and booking stay on the
                  club month.
                </p>
                <p className="mt-3 text-sm text-amber-100/80">
                  {formatPeso(TOURNAMENT_DAY_PHP)} a day. Pick the dates you
                  need.
                </p>
                {access.tournamentGrace ? (
                  <p className="mt-3 text-sm">Open until 6:00 AM.</p>
                ) : access.ownedTournamentDates.length > 0 ? (
                  <p className="mt-3 text-sm">
                    Paid for{" "}
                    {formatTournamentDateList(access.ownedTournamentDates)}.
                    Brackets open on those days.
                  </p>
                ) : null}
                <PlanContinue
                  kind="day"
                  label="Choose days"
                  icon={<Trophy className="h-4 w-4" aria-hidden />}
                  className="bg-amber-300 text-amber-950 hover:bg-amber-200"
                  onClick={() => setCheckout("day")}
                />
              </article>
            </div>
          )}
        </FormBusyProvider>
      </DialogContent>
    </Dialog>
  );
}

type CheckoutKind = "club" | "day";

function PaymentSentMark() {
  return (
    <div className="flex justify-center py-2">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--highlight)]/80 bg-[var(--highlight)]/15 text-[var(--highlight)]">
        <Check className="h-8 w-8" strokeWidth={2.5} aria-hidden />
      </div>
    </div>
  );
}

function checkoutHeading(
  checkout: CheckoutKind | null,
  plans: { plans: string; plansDetail: string },
): { title: string; detail: string } {
  if (checkout === "club") {
    return {
      title: "Club checkout",
      detail: collectsManualPayments()
        ? "Send the club amount by GCash, then upload the receipt."
        : "Pay for one club month.",
    };
  }
  if (checkout === "day") {
    return {
      title: "Tournament checkout",
      detail: collectsManualPayments()
        ? "Pick the days, send the amount by GCash, then upload the receipt."
        : "Pick the days, then pay.",
    };
  }
  return { title: plans.plans, detail: plans.plansDetail };
}

function PlanContinue({
  kind,
  label,
  onClick,
  className,
  icon,
}: {
  kind: CheckoutKind;
  label: string;
  onClick: () => void;
  className?: string;
  icon?: ReactNode;
}) {
  const { proofs } = usePlans();
  if (kind === "club" && proofWaiting(proofs, "club", null)) {
    return (
      <p className="mt-auto pt-4 text-sm text-[var(--muted)]">
        Payment sent. An admin will check it and open the month.
      </p>
    );
  }
  const dayWaiting =
    kind === "day" &&
    proofs.some((proof) => proof.kind === "day" && proof.status === "pending");

  return (
    <div className="mt-auto space-y-3 pt-4">
      {dayWaiting ? (
        <p className="text-sm text-amber-100/80">
          A receipt is already waiting to be checked. You can still send one for
          other days.
        </p>
      ) : null}
      <Button
        type="button"
        size="lg"
        className={cn("w-full", className)}
        onClick={onClick}
      >
        {icon}
        {label}
      </Button>
    </div>
  );
}

function CheckoutPanel({
  kind,
  today,
  onBack,
  clubClassName,
}: {
  kind: CheckoutKind;
  today: string;
  onBack: () => void;
  clubClassName?: string;
}) {
  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit px-2"
        onClick={onBack}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Plans
      </Button>
      {kind === "club" ? (
        <ClubPayForm label="Pay for 1 month" className={clubClassName} />
      ) : (
        <TournamentDatesForm today={today} />
      )}
    </div>
  );
}

function ClubPayForm({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const [quoting, setQuoting] = useState(false);
  const { proofs } = usePlans();
  const manual = collectsManualPayments();
  const waiting = proofWaiting(proofs, "club", null);

  if (manual && waiting) {
    return (
      <p className="mt-auto pt-4 text-sm text-[var(--muted)]">
        Payment sent. An admin will check it and open the month.
      </p>
    );
  }

  return (
    <form
      action={manual ? submitClubProofAction : startClubCheckoutAction}
      className="mt-auto space-y-3 pt-4"
    >
      <DiscountCodeFields
        id="discount-club"
        product="club"
        dates=""
        listCentavos={CLUB_PRICE_CENTAVOS}
        caption="for 1 month"
        onPending={setQuoting}
      />
      {manual ? <GcashReceipt kind="club" /> : null}
      <PendingSubmit busyId="club-pay" disabled={quoting} className={className}>
        {manual ? "Submit GCash receipt" : label}
      </PendingSubmit>
    </form>
  );
}

const GCASH_QR = {
  src: "/assets/personal-gcash-qr-code.jpeg",
  width: 860,
  height: 1014,
} as const;

function GcashReceipt({ kind }: { kind: "club" | "day" }) {
  const { gcash, proofs } = usePlans();
  const rejection = proofRejection(proofs, kind);
  const inputId = kind === "club" ? "club-receipt" : "day-receipt";
  const number = gcash ? formatGcashNumber(gcash.number) : null;

  return (
    <div className="space-y-3 text-sm">
      <section className="rounded-xl border border-sky-300/70 bg-[linear-gradient(180deg,rgba(56,189,248,0.18),rgba(0,0,0,0.2))] p-3 shadow-[0_0_32px_-16px_#38bdf8]">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-200">
          Send by GCash
        </p>
        <div className="mt-3 flex flex-col items-center gap-3">
          <Image
            src={GCASH_QR.src}
            alt={
              number
                ? `GCash QR code for ${number}`
                : "GCash QR code for this payment"
            }
            width={GCASH_QR.width}
            height={GCASH_QR.height}
            className="h-auto w-56 rounded-lg bg-white p-1.5"
          />
          <p className="text-xs text-sky-100/80">Scan with the GCash app</p>
          {number ? (
            <div className="w-full rounded-lg border border-sky-200/20 bg-black/30 px-3 py-2.5 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-100/70">
                or send to this number
              </p>
              {gcash?.name ? (
                <p className="mt-1 font-medium text-sky-50">{gcash.name}</p>
              ) : null}
              <p className="mt-0.5 font-[family-name:var(--font-display)] text-2xl tracking-wide text-white tabular-nums">
                {number}
              </p>
            </div>
          ) : null}
        </div>
      </section>
      {rejection ? (
        <p className="text-amber-200" role="alert">
          Last receipt was declined. {rejection}
        </p>
      ) : null}
      <div className="space-y-1 rounded-xl border border-[var(--border)] bg-black/20 p-3">
        <label htmlFor={inputId} className="font-medium">
          Receipt screenshot
        </label>
        <p className="text-xs text-[var(--muted)]">
          PNG, JPEG, or WebP. The plan opens after the payment is checked.
        </p>
        <input
          id={inputId}
          name="proof"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          required
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[var(--surface-2)] file:px-3 file:py-2 file:text-sm"
        />
      </div>
    </div>
  );
}

type AppliedDiscount = {
  key: string;
  code: string;
  dueCentavos: number;
};

function DiscountCodeFields({
  id,
  product,
  dates,
  listCentavos,
  caption,
  onPending,
  onQuote,
}: {
  id: string;
  product: "club" | "day";
  dates: string;
  listCentavos: number | null;
  caption: string;
  onPending: (pending: boolean) => void;
  onQuote?: (dueCentavos: number | null) => void;
}) {
  const [code, setCode] = useState("");
  const [quote, setQuote] = useState<AppliedDiscount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { pending: submitting } = useFormStatus();
  const busy = useContext(FormBusyContext);
  const quoteKey = `${product}:${dates}:${code.trim().toUpperCase()}`;
  const applied = quote?.key === quoteKey ? quote : null;
  const blocked = submitting || Boolean(busy?.active);

  useEffect(() => {
    onPending(pending);
    return () => onPending(false);
  }, [onPending, pending]);

  useEffect(() => {
    onQuote?.(applied?.dueCentavos ?? null);
  }, [applied?.dueCentavos, onQuote]);

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
      setQuote({
        key: current,
        code: result.code,
        dueCentavos: result.dueCentavos,
      });
    });
  }

  return (
    <div className="space-y-3">
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
            disabled={pending || blocked}
            onChange={(event) => {
              setCode(event.target.value);
              setError(null);
            }}
            className="bg-black/20 disabled:opacity-50"
          />
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            loading={pending}
            disabled={blocked || code.trim().length === 0}
            onClick={applyCode}
          >
            {pending ? "Applying…" : "Apply"}
          </Button>
        </div>
        {error ? (
          <p className="text-sm text-amber-200" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      {listCentavos != null ? (
        <PaymentBreakdown
          listCentavos={listCentavos}
          caption={caption}
          discount={applied}
        />
      ) : null}
    </div>
  );
}

function PaymentBreakdown({
  listCentavos,
  caption,
  discount,
}: {
  listCentavos: number;
  caption: string;
  discount: AppliedDiscount | null;
}) {
  const off = discount ? listCentavos - discount.dueCentavos : 0;
  const discounted = discount != null && off > 0;
  const due = discounted ? discount.dueCentavos : listCentavos;

  return (
    <div
      className="rounded-xl border border-[var(--highlight)]/80 bg-[var(--highlight)]/10 px-3 py-3"
      role="status"
    >
      {discounted ? (
        <div className="mb-3 space-y-1.5 border-b border-[var(--highlight)]/30 pb-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[var(--muted)]">Subtotal</span>
            <span className="text-[var(--muted)] line-through tabular-nums">
              {formatCheckoutPesos(listCentavos)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Discount</span>
            <span className="font-medium text-emerald-200 tabular-nums">
              {discount.code} · −{formatCheckoutPesos(off)}
            </span>
          </div>
        </div>
      ) : null}
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--highlight)]">
        You pay
      </p>
      <p className="font-[family-name:var(--font-display)] text-4xl tabular-nums">
        {formatCheckoutPesos(due)}
      </p>
      {caption ? (
        <p className="text-sm text-[var(--muted)]">{caption}</p>
      ) : null}
    </div>
  );
}

function TournamentDatesForm({ today }: { today: string }) {
  const { access, proofs } = usePlans();
  const ownedDates = access.ownedTournamentDates;
  const [dates, setDates] = useState<string[]>([]);
  const [quoting, setQuoting] = useState(false);
  const [dueCentavos, setDueCentavos] = useState<number | null>(null);
  const totalCentavos = tournamentDatesPriceCentavos(dates);
  const rate = dates.length === 0 ? null : tournamentDayRatePhp(dates.length);
  const manual = collectsManualPayments();
  const dateKey = dates.join(",");
  const waiting = dateKey ? proofWaiting(proofs, "day", dateKey) : null;
  const payable = dueCentavos ?? totalCentavos;
  const dayLabel = dates.length === 1 ? "day" : "days";
  const payLabel = manual
    ? "Submit GCash receipt"
    : payable == null || rate == null
      ? "Pay for these days"
      : `Pay ${formatCheckoutPesos(payable)} · ${dates.length} ${dayLabel} at ${formatPeso(rate)}`;

  function toggleDate(iso: string) {
    setDates((current) => {
      if (ownedDates.includes(iso)) return current;
      if (current.includes(iso)) return current.filter((item) => item !== iso);
      if (iso < today || current.length >= TOURNAMENT_MAX_DAYS) return current;
      return [...current, iso].sort();
    });
  }

  return (
    <form
      action={manual ? submitTournamentProofAction : startTournamentPassAction}
      className="mt-4 space-y-3"
    >
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
        <SelectedDateChips dates={dates} onToggle={toggleDate} />
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
        listCentavos={totalCentavos}
        caption={
          rate == null
            ? ""
            : `${dates.length} ${dayLabel} at ${formatPeso(rate)}`
        }
        onPending={setQuoting}
        onQuote={setDueCentavos}
      />
      {manual && waiting ? (
        <p className="text-sm text-amber-100/80">
          A receipt for these days is already waiting to be checked.
        </p>
      ) : manual ? (
        <GcashReceipt kind="day" />
      ) : null}
      <PendingSubmit
        busyId="tournament-pay"
        disabled={dates.length === 0 || quoting || Boolean(waiting)}
        className="bg-amber-300 text-amber-950 hover:bg-amber-200"
      >
        <Trophy className="h-4 w-4" aria-hidden />
        {payLabel}
      </PendingSubmit>
    </form>
  );
}

function SelectedDateChips({
  dates,
  onToggle,
}: {
  dates: string[];
  onToggle: (iso: string) => void;
}) {
  const { pending } = useFormStatus();

  return (
    <ul className="flex flex-wrap gap-2">
      {dates.map((date) => (
        <li key={date}>
          <button
            type="button"
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-full border border-amber-300/50 bg-black/20 px-2.5 py-1 text-xs text-amber-50 disabled:opacity-50"
            onClick={() => onToggle(date)}
          >
            {formatTournamentDates(date, date)}
            <X className="h-3 w-3" aria-hidden />
            <span className="sr-only">Remove {date}</span>
          </button>
        </li>
      ))}
    </ul>
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
  const { pending } = useFormStatus();
  const [box, setBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const atCap = dates.length >= TOURNAMENT_MAX_DAYS;
  const expanded = open && !pending;

  useLayoutEffect(() => {
    if (!expanded) return;
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
  }, [expanded, month]);

  useEffect(() => {
    if (!expanded) return;
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
  }, [expanded]);

  const blanks = leadingBlanks(month);
  const dayCount = daysInMonth(month);
  const label = fieldLabel(dates);
  const calendar =
    expanded && box
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
                  disabled={pending || month <= monthOf(today)}
                  onClick={() => setMonth((current) => shiftMonth(current, -1))}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--foreground)] hover:bg-white/10 disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  disabled={pending}
                  onClick={() => setMonth((current) => shiftMonth(current, 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--foreground)] hover:bg-white/10 disabled:pointer-events-none disabled:opacity-30"
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
                    disabled={disabled || pending}
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
        aria-expanded={expanded}
        disabled={pending}
        onClick={() => {
          setMonth(monthOf(dates[0] ?? today));
          setOpen((current) => !current);
        }}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-md border bg-black/20 px-3 text-left text-sm",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200",
          expanded ? "border-amber-300" : "border-amber-200/30",
          dates.length === 0 ? "text-amber-100/60" : "text-amber-50",
          "disabled:opacity-50",
        )}
      >
        <span className="truncate">{label}</span>
        <Calendar className="h-4 w-4 shrink-0 text-amber-100/80" aria-hidden />
      </button>
      {calendar}
    </div>
  );
}
