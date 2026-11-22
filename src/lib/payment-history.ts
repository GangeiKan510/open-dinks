import { paymentAmountCentavos, type SaleKind } from "@/lib/admin-sales";

export type PaymentHistoryStatus = "pending" | "approved" | "rejected" | "paid";

export type PaymentHistoryItem = {
  id: string;
  createdAt: string;
  kind: SaleKind;
  amountCentavos: number;
  status: PaymentHistoryStatus;
  datesLabel: string | null;
  note: string | null;
  discountCode: string | null;
};

const PROOF_STATUSES = new Set<PaymentHistoryStatus>([
  "pending",
  "approved",
  "rejected",
]);

export type ProofHistoryRow = {
  id: string;
  kind: string;
  amount_centavos: number;
  discount_code: string | null;
  dates: string | null;
  status: string;
  review_note: string | null;
  created_at: string;
};

export type GatewayPaymentRow = {
  checkout_id: string;
  kind: string;
  amount_centavos: number | null;
  created_at: string;
};

function isSaleKind(value: string): value is SaleKind {
  return value === "club" || value === "day" || value === "weekend";
}

function isProofStatus(value: string): value is PaymentHistoryStatus {
  return PROOF_STATUSES.has(value as PaymentHistoryStatus);
}

/** Calendar dates from a receipt, in the order they were stored. */
export function formatProofDates(dates: string | null): string | null {
  if (!dates) return null;
  const labels = dates
    .split(",")
    .map((date) => date.trim())
    .filter((date) => date.length > 0)
    .map((iso) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
      const parsed = new Date(`${iso}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime())) return iso;
      if (parsed.toISOString().slice(0, 10) !== iso) return iso;
      return new Intl.DateTimeFormat("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(parsed);
    });
  return labels.length > 0 ? labels.join(", ") : null;
}

/**
 * Receipts are the host-facing record. A `manual_` payment row is the same
 * approval, so it is not listed again.
 */
export function buildPaymentHistory(
  proofs: ProofHistoryRow[],
  payments: GatewayPaymentRow[],
): PaymentHistoryItem[] {
  const items: PaymentHistoryItem[] = [];
  const proofIds = new Set<string>();

  for (const proof of proofs) {
    if (!isSaleKind(proof.kind) || proof.kind === "weekend") continue;
    if (!isProofStatus(proof.status)) continue;
    proofIds.add(proof.id);
    const note = proof.review_note?.trim() ?? "";
    items.push({
      id: `proof:${proof.id}`,
      createdAt: proof.created_at,
      kind: proof.kind,
      amountCentavos: proof.amount_centavos,
      status: proof.status,
      datesLabel: proof.kind === "day" ? formatProofDates(proof.dates) : null,
      note: proof.status === "rejected" && note ? note : null,
      discountCode: proof.discount_code,
    });
  }

  for (const payment of payments) {
    if (!isSaleKind(payment.kind)) continue;
    const manualId = payment.checkout_id.startsWith("manual_")
      ? payment.checkout_id.slice("manual_".length)
      : null;
    if (manualId && proofIds.has(manualId)) continue;
    items.push({
      id: `payment:${payment.checkout_id}`,
      createdAt: payment.created_at,
      kind: payment.kind,
      amountCentavos: paymentAmountCentavos({
        kind: payment.kind,
        amountCentavos: payment.amount_centavos,
      }),
      status: "paid",
      datesLabel: null,
      note: null,
      discountCode: null,
    });
  }

  return items
    .map((item) => ({ item, at: new Date(item.createdAt).getTime() }))
    .sort((a, b) => {
      const aTime = Number.isNaN(a.at) ? 0 : a.at;
      const bTime = Number.isNaN(b.at) ? 0 : b.at;
      return bTime - aTime;
    })
    .map(({ item }) => item);
}

export function formatPaymentAmount(centavos: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: centavos % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(centavos / 100);
}

export function paymentHistoryStatusLabel(
  status: PaymentHistoryStatus,
): string {
  if (status === "pending") return "Waiting";
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Declined";
  return "Paid";
}
