import Link from "next/link";
import {
  approveManualPaymentAction,
  rejectManualPaymentAction,
} from "@/app/actions/admin";
import { PanelHeading, PanelNote } from "@/components/admin/panel";
import { CopyReferenceButton } from "@/components/billing/copy-reference-button";
import { PaymentFigures } from "@/components/billing/payment-figures";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatAdminWhen } from "@/lib/admin-activity";
import { ADMIN_ERROR_MESSAGES } from "@/lib/admin-messages";
import {
  filterPaymentQueue,
  parsePaymentQueueSort,
  sortPaymentQueue,
  type PaymentQueueSort,
} from "@/lib/admin-payments";
import { saleKindLabel } from "@/lib/admin-sales";
import { loadPaymentProofs } from "@/lib/admin-server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Payments" };

const SORTS: { id: PaymentQueueSort; label: string }[] = [
  { id: "oldest", label: "Oldest" },
  { id: "newest", label: "Newest" },
  { id: "facility", label: "Facility" },
];

function queueHref(query: string, sort: PaymentQueueSort): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (sort !== "oldest") params.set("sort", sort);
  const search = params.toString();
  return search ? `/admin/payments?${search}` : "/admin/payments";
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ review?: string; q?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const review = params?.review;
  const query = params?.q ?? "";
  const sort = parsePaymentQueueSort(params?.sort);
  const loaded = await loadPaymentProofs();
  const proofs = loaded.ok
    ? sortPaymentQueue(filterPaymentQueue(loaded.data, query), sort)
    : [];

  return (
    <>
      <PanelHeading
        title="Payments"
        body="GCash receipts waiting for a check. Approving opens the club month or the tournament days. PayMongo checkout stays off this screen."
      />
      {review === "approved" ? (
        <PanelNote>Plan opened.</PanelNote>
      ) : review === "rejected" ? (
        <PanelNote>Receipt declined. The host can send another one.</PanelNote>
      ) : review === "failed" ? (
        <PanelNote>{ADMIN_ERROR_MESSAGES.paymentReviewFailed}</PanelNote>
      ) : null}
      {!loaded.ok ? (
        <PanelNote>{loaded.message}</PanelNote>
      ) : (
        <>
          {loaded.data.length > 0 || query.trim() ? (
            <form
              action="/admin/payments"
              className="flex flex-wrap items-end gap-3"
            >
              {sort !== "oldest" ? (
                <input type="hidden" name="sort" value={sort} />
              ) : null}
              <div className="min-w-64 flex-1 space-y-1">
                <label
                  htmlFor="payment-search"
                  className="text-xs text-[var(--muted)]"
                >
                  Search
                </label>
                <Input
                  id="payment-search"
                  name="q"
                  defaultValue={query}
                  placeholder="Reference or facility name"
                  autoComplete="off"
                />
              </div>
              <Button type="submit" variant="outline">
                Search
              </Button>
              <div
                className="flex gap-1"
                role="group"
                aria-label="Sort receipts"
              >
                {SORTS.map((option) => (
                  <Link
                    key={option.id}
                    href={queueHref(query.trim(), option.id)}
                    aria-current={sort === option.id ? "true" : undefined}
                    className={cn(
                      "rounded-full px-3 py-2 text-sm",
                      sort === option.id
                        ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]",
                    )}
                  >
                    {option.label}
                  </Link>
                ))}
              </div>
            </form>
          ) : null}
          {loaded.data.length === 0 ? (
            <PanelNote>No receipts waiting.</PanelNote>
          ) : proofs.length === 0 ? (
            <PanelNote>No receipts match that search.</PanelNote>
          ) : (
            <ul className="space-y-4">
              {proofs.map((proof) => (
                <li
                  key={proof.id}
                  className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:grid-cols-[16rem_1fr]"
                >
                  {proof.receiptUrl ? (
                    <a href={proof.receiptUrl} target="_blank" rel="noreferrer">
                      {/* Signed storage URLs are private and short-lived. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={proof.receiptUrl}
                        alt={`GCash receipt from ${proof.facilityName}`}
                        className="h-64 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] object-contain"
                      />
                    </a>
                  ) : (
                    <p className="text-sm text-[var(--muted)]">
                      The receipt file could not be opened.
                    </p>
                  )}
                  <div className="space-y-3">
                    <div>
                      <p className="font-semibold">{proof.facilityName}</p>
                      <p className="text-sm text-[var(--muted)]">
                        {formatAdminWhen(proof.createdAt)}
                      </p>
                      <div className="mt-1 flex items-center gap-1">
                        <p className="break-all font-mono text-xs tracking-wide text-[var(--muted)]">
                          Reference {proof.id}
                        </p>
                        <CopyReferenceButton value={proof.id} />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="text-sm">{saleKindLabel(proof.kind)}</p>
                      <PaymentFigures
                        dueCentavos={proof.amountCentavos}
                        listCentavos={proof.listCentavos}
                        discountCode={proof.discountCode}
                      />
                    </div>
                    {proof.dates ? (
                      <p className="text-sm text-[var(--muted)]">
                        {proof.dates}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-end gap-3">
                      <form action={approveManualPaymentAction}>
                        <input type="hidden" name="id" value={proof.id} />
                        <Button type="submit">Approve</Button>
                      </form>
                      <form
                        action={rejectManualPaymentAction}
                        className="flex flex-wrap items-end gap-2"
                      >
                        <input type="hidden" name="id" value={proof.id} />
                        <div className="space-y-1">
                          <label
                            htmlFor={`note-${proof.id}`}
                            className="text-xs text-[var(--muted)]"
                          >
                            Note for the host
                          </label>
                          <Input
                            id={`note-${proof.id}`}
                            name="note"
                            maxLength={240}
                            placeholder="Optional"
                            className="w-64"
                          />
                        </div>
                        <Button type="submit" variant="danger">
                          Decline
                        </Button>
                      </form>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
