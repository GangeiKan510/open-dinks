"use client";

import { useState } from "react";
import { CopyReferenceButton } from "@/components/billing/copy-reference-button";
import { PaymentFigures } from "@/components/billing/payment-figures";
import { Input } from "@/components/ui/input";
import { saleKindLabel } from "@/lib/admin-sales";
import {
  filterPaymentHistory,
  paymentHistoryStatusLabel,
  type PaymentHistoryItem,
  type PaymentHistoryKindFilter,
  type PaymentHistoryStatus,
  type PaymentHistoryStatusFilter,
} from "@/lib/payment-history";
import { cn } from "@/lib/utils";

const CARD = "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5";

const KIND_FILTERS: { id: PaymentHistoryKindFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "club", label: "Club" },
  { id: "tournament", label: "Tournament" },
];

const STATUS_FILTERS: { id: PaymentHistoryStatusFilter; label: string }[] = [
  { id: "all", label: "Any status" },
  { id: "pending", label: "Waiting" },
  { id: "approved", label: "Approved" },
  { id: "paid", label: "Paid" },
  { id: "rejected", label: "Declined" },
];

function formatWhen(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

function statusTone(status: PaymentHistoryStatus): string {
  if (status === "pending") return "border-amber-400/50 bg-amber-400/10";
  if (status === "approved") return "border-emerald-400/40 bg-emerald-400/10";
  if (status === "rejected") return "border-red-400/40 bg-red-400/10";
  return "border-sky-400/40 bg-sky-400/10";
}

function statusLabelTone(status: PaymentHistoryStatus): string {
  if (status === "pending") return "bg-amber-300 text-amber-950";
  if (status === "approved") return "bg-emerald-300 text-emerald-950";
  if (status === "rejected") return "bg-red-300 text-red-950";
  return "bg-sky-300 text-sky-950";
}

function kindTone(kind: PaymentHistoryItem["kind"]): string {
  return kind === "club" ? "text-emerald-200" : "text-amber-100";
}

function FilterChip({
  selected,
  label,
  onClick,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 shrink-0 items-center rounded-full px-3 text-xs font-semibold",
        selected
          ? "bg-[var(--accent)] text-[var(--accent-fg)]"
          : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground)]",
      )}
    >
      {label}
    </button>
  );
}

export function PaymentHistory({
  items,
  timeZone,
  capped,
}: {
  items: PaymentHistoryItem[];
  timeZone: string;
  capped: boolean;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<PaymentHistoryKindFilter>("all");
  const [status, setStatus] = useState<PaymentHistoryStatusFilter>("all");
  const visible = filterPaymentHistory(items, { query, kind, status });

  return (
    <section className={CARD}>
      <h2 className="font-semibold">Payment history</h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">No payments yet.</p>
      ) : (
        <>
          <div className="mt-4 space-y-3">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search reference, date, or code"
              aria-label="Search payment history"
            />
            <div className="flex flex-wrap gap-2">
              {KIND_FILTERS.map((option) => (
                <FilterChip
                  key={option.id}
                  label={option.label}
                  selected={kind === option.id}
                  onClick={() => setKind(option.id)}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((option) => (
                <FilterChip
                  key={option.id}
                  label={option.label}
                  selected={status === option.id}
                  onClick={() => setStatus(option.id)}
                />
              ))}
            </div>
          </div>
          {visible.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              No payments match that search.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {visible.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    "flex flex-wrap items-start justify-between gap-3 rounded-xl border px-3 py-3",
                    statusTone(item.status),
                  )}
                >
                  <div className="min-w-0">
                    <p className={cn("font-medium", kindTone(item.kind))}>
                      {saleKindLabel(item.kind)}
                    </p>
                    <p className="text-sm text-[var(--muted)]">
                      {formatWhen(item.createdAt, timeZone)}
                    </p>
                    <div className="mt-1 flex items-center gap-1">
                      <p className="break-all font-mono text-xs tracking-wide text-[var(--muted)]">
                        Reference {item.reference}
                      </p>
                      <CopyReferenceButton value={item.reference} />
                    </div>
                    {item.datesLabel ? (
                      <p className="mt-1 text-sm">{item.datesLabel}</p>
                    ) : null}
                    {item.listCentavos == null && item.discountCode ? (
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Code {item.discountCode}
                      </p>
                    ) : null}
                    {item.note ? (
                      <p className="mt-1 text-sm text-amber-200" role="status">
                        {item.note}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <PaymentFigures
                      dueCentavos={item.amountCentavos}
                      listCentavos={item.listCentavos}
                      discountCode={item.discountCode}
                    />
                    <p className="mt-1">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                          statusLabelTone(item.status),
                        )}
                      >
                        {paymentHistoryStatusLabel(item.status)}
                      </span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {capped ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          Showing the latest 50.
        </p>
      ) : null}
    </section>
  );
}
