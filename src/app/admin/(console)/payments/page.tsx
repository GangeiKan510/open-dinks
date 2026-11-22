import {
  approveManualPaymentAction,
  rejectManualPaymentAction,
} from "@/app/actions/admin";
import { PanelHeading, PanelNote } from "@/components/admin/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatAdminWhen } from "@/lib/admin-activity";
import { ADMIN_ERROR_MESSAGES } from "@/lib/admin-messages";
import { formatCentavos, saleKindLabel } from "@/lib/admin-sales";
import { loadPaymentProofs } from "@/lib/admin-server";

export const metadata = { title: "Payments" };

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ review?: string }>;
}) {
  const review = (await searchParams)?.review;
  const loaded = await loadPaymentProofs();

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
      ) : loaded.data.length === 0 ? (
        <PanelNote>No receipts waiting.</PanelNote>
      ) : (
        <ul className="space-y-4">
          {loaded.data.map((proof) => (
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
                </div>
                <p className="text-sm">
                  {saleKindLabel(proof.kind)} ·{" "}
                  <span className="tabular-nums">
                    {formatCentavos(proof.amountCentavos)}
                  </span>
                  {proof.discountCode ? ` · code ${proof.discountCode}` : ""}
                </p>
                {proof.dates ? (
                  <p className="text-sm text-[var(--muted)]">{proof.dates}</p>
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
  );
}
