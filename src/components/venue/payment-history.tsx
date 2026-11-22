import { CopyReferenceButton } from "@/components/billing/copy-reference-button";
import { PaymentFigures } from "@/components/billing/payment-figures";
import { saleKindLabel } from "@/lib/admin-sales";
import {
  paymentHistoryStatusLabel,
  type PaymentHistoryItem,
} from "@/lib/payment-history";

const CARD = "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5";

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

export function PaymentHistory({
  items,
  timeZone,
  capped,
}: {
  items: PaymentHistoryItem[];
  timeZone: string;
  capped: boolean;
}) {
  return (
    <section className={CARD}>
      <h2 className="font-semibold">Payment history</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        GCash receipts and confirmed payments for this club.
      </p>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">No payments yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--border)]">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div>
                <p className="font-medium">{saleKindLabel(item.kind)}</p>
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
                <p className="text-sm text-[var(--muted)]">
                  {paymentHistoryStatusLabel(item.status)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {capped ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          Showing the latest 50.
        </p>
      ) : null}
    </section>
  );
}
