import { describe, expect, it } from "vitest";
import {
  buildPaymentHistory,
  formatPaymentAmount,
  formatProofDates,
} from "./payment-history";

describe("payment history", () => {
  it("lists a receipt once and keeps an older gateway payment", () => {
    const items = buildPaymentHistory(
      [
        {
          id: "proof-1",
          kind: "club",
          amount_centavos: 66405,
          discount_code: "5PERCENT",
          dates: null,
          status: "approved",
          review_note: null,
          created_at: "2026-11-22T04:00:00.000Z",
        },
      ],
      [
        {
          checkout_id: "manual_proof-1",
          kind: "club",
          amount_centavos: 66405,
          created_at: "2026-11-22T04:05:00.000Z",
        },
        {
          checkout_id: "cs_old",
          kind: "day",
          amount_centavos: 150000,
          created_at: "2026-11-01T04:00:00.000Z",
        },
      ],
    );

    expect(items.map((item) => item.id)).toEqual([
      "proof:proof-1",
      "payment:cs_old",
    ]);
    expect(items[0]).toMatchObject({
      status: "approved",
      amountCentavos: 66405,
      discountCode: "5PERCENT",
    });
    expect(items[1]?.status).toBe("paid");
  });

  it("keeps a declined note and the tournament days", () => {
    const items = buildPaymentHistory(
      [
        {
          id: "proof-2",
          kind: "day",
          amount_centavos: 300000,
          discount_code: null,
          dates: "2026-11-27,2026-11-29",
          status: "rejected",
          review_note: " Amount does not match. ",
          created_at: "2026-11-20T04:00:00.000Z",
        },
      ],
      [],
    );

    expect(items[0]).toMatchObject({
      status: "rejected",
      note: "Amount does not match.",
      datesLabel: "Nov 27, 2026, Nov 29, 2026",
    });
  });

  it("formats a whole peso without centavos", () => {
    expect(formatPaymentAmount(69900)).toBe("₱699");
    expect(formatPaymentAmount(66405)).toBe("₱664.05");
    expect(formatProofDates("2026-02-30")).toBe("2026-02-30");
  });
});
