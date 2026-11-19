import { createHmac, timingSafeEqual } from "node:crypto";

const PAYMONGO_API = "https://api.paymongo.com/v2/checkout_sessions";

/** Card, GCash, Maya, and QR Ph. Hosted Checkout hides any method the account cannot use. */
export const PAYMONGO_PAYMENT_METHODS = [
  "card",
  "gcash",
  "paymaya",
  "qrph",
] as const;

const SIGNATURE_MAX_AGE_SECONDS = 5 * 60;

export function isPaymongoConfigured(): boolean {
  return Boolean(process.env.PAYMONGO_SECRET_KEY);
}

export type PaymongoCheckoutLine = {
  name: string;
  amount: number;
  description?: string;
};

export type PaymongoCheckoutInput = {
  line: PaymongoCheckoutLine;
  successUrl: string;
  cancelUrl: string;
  referenceNumber: string;
  metadata: Record<string, string>;
};

type PaymongoCheckoutResponse = {
  data?: {
    id?: string;
    attributes?: { checkout_url?: string };
  };
};

export type CreatedPaymongoCheckout = {
  id: string;
  url: string;
};

export async function createPaymongoCheckout(
  input: PaymongoCheckoutInput,
): Promise<CreatedPaymongoCheckout> {
  const secret = process.env.PAYMONGO_SECRET_KEY?.trim();
  if (!secret) throw new Error("Missing PAYMONGO_SECRET_KEY");

  const response = await fetch(PAYMONGO_API, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [
            {
              name: input.line.name,
              amount: input.line.amount,
              currency: "PHP",
              quantity: 1,
              description: input.line.description,
            },
          ],
          payment_method_types: [...PAYMONGO_PAYMENT_METHODS],
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          reference_number: input.referenceNumber,
          metadata: input.metadata,
          send_email_receipt: false,
        },
      },
    }),
  });

  if (!response.ok) {
    console.error("[billing] PayMongo checkout failed", response.status);
    throw new Error("PayMongo checkout failed");
  }

  const body = (await response.json()) as PaymongoCheckoutResponse;
  const id = body.data?.id;
  const url = body.data?.attributes?.checkout_url;
  if (!id || !url) throw new Error("PayMongo checkout failed");
  return { id, url };
}

function headerParts(header: string): Record<string, string> {
  const parts: Record<string, string> = {};
  for (const piece of header.split(",")) {
    const index = piece.indexOf("=");
    if (index === -1) continue;
    parts[piece.slice(0, index).trim()] = piece.slice(index + 1).trim();
  }
  return parts;
}

/** True when Paymongo-Signature matches the raw body for the event mode. */
export function paymongoSignatureMatches(input: {
  header: string;
  rawBody: string;
  secret: string;
  livemode: boolean;
  nowSeconds: number;
}): boolean {
  const parts = headerParts(input.header);
  const timestamp = Number(parts.t);
  const presented = input.livemode ? parts.li : parts.te;
  if (!Number.isFinite(timestamp) || !presented) return false;
  if (Math.abs(input.nowSeconds - timestamp) > SIGNATURE_MAX_AGE_SECONDS) {
    return false;
  }

  const digest = createHmac("sha256", input.secret)
    .update(`${parts.t}.${input.rawBody}`)
    .digest("hex");
  const actual = Buffer.from(digest);
  const expected = Buffer.from(presented);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export type PaidCheckout = {
  id: string;
  livemode: boolean;
  metadata: Record<string, string>;
  paymentIds: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringMetadata(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const metadata: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") metadata[key] = entry;
  }
  return metadata;
}

function hasPaidPayment(attributes: Record<string, unknown>): boolean {
  if (!Array.isArray(attributes.payments)) return false;
  return attributes.payments.some((payment) => {
    if (!isRecord(payment) || !isRecord(payment.attributes)) return false;
    return payment.attributes.status === "paid";
  });
}

function sessionFromResource(
  row: unknown,
): { id: string; metadata: Record<string, string> } | null {
  if (!isRecord(row) || typeof row.id !== "string" || !row.id) return null;
  if (!isRecord(row.attributes) || !hasPaidPayment(row.attributes)) return null;
  return {
    id: row.id,
    metadata: stringMetadata(row.attributes.metadata),
  };
}

/** Paid checkout sessions from a retrieve or list response. Unpaid rows are dropped. */
export function paidCheckoutsFromApi(
  body: unknown,
): { id: string; metadata: Record<string, string> }[] {
  if (!isRecord(body)) return [];
  const rows = Array.isArray(body.data) ? body.data : [body.data];
  const paid = [];
  for (const row of rows) {
    const session = sessionFromResource(row);
    if (session) paid.push(session);
  }
  return paid;
}

const CHECKOUT_ID = /^cs_[A-Za-z0-9]+$/;

function paymongoAuthHeader(): string | null {
  const secret = process.env.PAYMONGO_SECRET_KEY?.trim();
  if (!secret) return null;
  return `Basic ${Buffer.from(`${secret}:`).toString("base64")}`;
}

export async function retrievePaidCheckout(
  id: string,
): Promise<{ id: string; metadata: Record<string, string> } | null> {
  if (!CHECKOUT_ID.test(id)) return null;
  const authorization = paymongoAuthHeader();
  if (!authorization) return null;
  const response = await fetch(
    `https://api.paymongo.com/v1/checkout_sessions/${id}`,
    { headers: { Authorization: authorization } },
  );
  if (!response.ok) {
    console.error("[billing] checkout retrieve failed", response.status);
    return null;
  }
  return paidCheckoutsFromApi(await response.json())[0] ?? null;
}

function paymentIdsFrom(attributes: Record<string, unknown>): string[] {
  if (!Array.isArray(attributes.payments)) return [];
  const ids: string[] = [];
  for (const payment of attributes.payments) {
    if (isRecord(payment) && typeof payment.id === "string" && payment.id) {
      ids.push(payment.id);
    }
  }
  return ids;
}

export type PaidPayment = {
  id: string;
  amount: number;
  metadata: Record<string, string>;
  reference: string;
};

const PAYMENT_KINDS = ["club", "day", "weekend"] as const;
export type ListedPaymentKind = (typeof PAYMENT_KINDS)[number];

function isListedKind(value: string | undefined): value is ListedPaymentKind {
  return value === "club" || value === "day" || value === "weekend";
}

/** Paid Payment resources. Checkout sessions cannot be listed. */
export function paidPaymentsFromApi(body: unknown): PaidPayment[] {
  if (!isRecord(body) || !Array.isArray(body.data)) return [];
  const payments: PaidPayment[] = [];
  for (const row of body.data) {
    if (!isRecord(row) || typeof row.id !== "string" || !row.id) continue;
    if (!isRecord(row.attributes)) continue;
    if (row.attributes.status !== "paid") continue;
    const amount = Number(row.attributes.amount);
    const intent = isRecord(row.attributes.payment_intent)
      ? row.attributes.payment_intent
      : null;
    const intentAttributes =
      intent && isRecord(intent.attributes) ? intent.attributes : null;
    const metadata = {
      ...stringMetadata(intentAttributes?.metadata),
      ...stringMetadata(row.attributes.metadata),
    };
    const reference =
      (typeof row.attributes.external_reference_number === "string"
        ? row.attributes.external_reference_number
        : "") ||
      (typeof row.attributes.reference_number === "string"
        ? row.attributes.reference_number
        : "");
    payments.push({
      id: row.id,
      amount: Number.isFinite(amount) ? amount : 0,
      metadata,
      reference,
    });
  }
  return payments;
}

/** Which plan a paid payment bought for this club, when PayMongo kept our reference. */
export function paymentPlanForFacility(
  payment: PaidPayment,
  facilityId: string,
): ListedPaymentKind | null {
  if (!facilityId) return null;
  if (
    payment.metadata.facility_id === facilityId &&
    isListedKind(payment.metadata.kind)
  ) {
    return payment.metadata.kind;
  }
  for (const kind of PAYMENT_KINDS) {
    if (payment.reference === `${kind}-${facilityId}`) return kind;
  }
  return null;
}

export async function listRecentPaidPayments(): Promise<PaidPayment[]> {
  const authorization = paymongoAuthHeader();
  if (!authorization) return [];
  const response = await fetch(
    "https://api.paymongo.com/v1/payments?limit=10",
    { headers: { Authorization: authorization } },
  );
  if (!response.ok) {
    console.error("[billing] payment list failed", response.status);
    return [];
  }
  return paidPaymentsFromApi(await response.json());
}

function paymentsIncludePaid(attributes: Record<string, unknown>): boolean {
  if (!Array.isArray(attributes.payments)) return true;
  return attributes.payments.some((payment) => {
    if (!isRecord(payment) || !isRecord(payment.attributes)) return false;
    return payment.attributes.status === "paid";
  });
}

export function paymongoLivemode(body: unknown): boolean {
  if (!isRecord(body) || !isRecord(body.data)) return false;
  if (isRecord(body.data.attributes))
    return body.data.attributes.livemode === true;
  return body.data.livemode === true;
}

/**
 * Reads a paid Checkout Session from either PayMongo webhook envelope.
 * Returns null unless the event is checkout_session.payment.paid and a
 * payment in the payload is paid.
 */
export function paidCheckoutFromWebhook(body: unknown): PaidCheckout | null {
  if (!isRecord(body) || !isRecord(body.data)) return null;

  let type = "";
  let livemode = false;
  let session: unknown;

  if (
    isRecord(body.data.attributes) &&
    typeof body.data.attributes.type === "string"
  ) {
    type = body.data.attributes.type;
    livemode = body.data.attributes.livemode === true;
    session = body.data.attributes.data;
  } else if (typeof body.data.type === "string") {
    type = body.data.type;
    livemode = body.data.livemode === true;
    session = body.data.data;
  }

  if (type !== "checkout_session.payment.paid" || !isRecord(session))
    return null;
  if (typeof session.id !== "string" || !session.id) return null;
  if (
    !isRecord(session.attributes) ||
    !paymentsIncludePaid(session.attributes)
  ) {
    return null;
  }

  return {
    id: session.id,
    livemode,
    metadata: stringMetadata(session.attributes.metadata),
    paymentIds: paymentIdsFrom(session.attributes),
  };
}
