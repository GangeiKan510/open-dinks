import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  paidCheckoutFromWebhook,
  paymongoSignatureMatches,
} from "@/lib/paymongo";

const SECRET = "whsk_test";
const BODY = JSON.stringify({ ok: true });
const TIMESTAMP = 1_700_000_000;

function sign(livemode: boolean): string {
  const digest = createHmac("sha256", SECRET)
    .update(`${TIMESTAMP}.${BODY}`)
    .digest("hex");
  return livemode
    ? `t=${TIMESTAMP},te=,li=${digest}`
    : `t=${TIMESTAMP},te=${digest},li=`;
}

describe("paymongoSignatureMatches", () => {
  it("accepts the test-mode signature and rejects the live one for the same header", () => {
    const header = sign(false);
    expect(
      paymongoSignatureMatches({
        header,
        rawBody: BODY,
        secret: SECRET,
        livemode: false,
        nowSeconds: TIMESTAMP + 10,
      }),
    ).toBe(true);
    expect(
      paymongoSignatureMatches({
        header,
        rawBody: BODY,
        secret: SECRET,
        livemode: true,
        nowSeconds: TIMESTAMP + 10,
      }),
    ).toBe(false);
  });

  it("rejects a signature older than five minutes", () => {
    expect(
      paymongoSignatureMatches({
        header: sign(true),
        rawBody: BODY,
        secret: SECRET,
        livemode: true,
        nowSeconds: TIMESTAMP + 301,
      }),
    ).toBe(false);
  });
});

describe("paidCheckoutFromWebhook", () => {
  const session = {
    id: "cs_123",
    type: "checkout_session",
    attributes: {
      metadata: { facility_id: "fac_1", kind: "club", ignored: 4 },
      payments: [{ attributes: { status: "paid" } }],
    },
  };

  it("reads the event resource envelope", () => {
    expect(
      paidCheckoutFromWebhook({
        data: {
          attributes: {
            type: "checkout_session.payment.paid",
            livemode: false,
            data: session,
          },
        },
      }),
    ).toEqual({
      id: "cs_123",
      livemode: false,
      metadata: { facility_id: "fac_1", kind: "club" },
    });
  });

  it("reads the hosted checkout envelope", () => {
    expect(
      paidCheckoutFromWebhook({
        data: {
          type: "checkout_session.payment.paid",
          livemode: true,
          data: session,
        },
      })?.livemode,
    ).toBe(true);
  });

  it("ignores a checkout that has no paid payment", () => {
    expect(
      paidCheckoutFromWebhook({
        data: {
          type: "checkout_session.payment.paid",
          livemode: true,
          data: {
            ...session,
            attributes: {
              ...session.attributes,
              payments: [{ attributes: { status: "failed" } }],
            },
          },
        },
      }),
    ).toBeNull();
  });
});
