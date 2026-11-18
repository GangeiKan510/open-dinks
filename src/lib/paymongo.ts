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

export async function createPaymongoCheckout(
  input: PaymongoCheckoutInput,
): Promise<string> {
  const secret = process.env.PAYMONGO_SECRET_KEY;
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
  const url = body.data?.attributes?.checkout_url;
  if (!url) throw new Error("PayMongo checkout failed");
  return url;
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
  };
}
