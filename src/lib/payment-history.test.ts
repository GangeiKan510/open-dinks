import { describe, expect, it } from "vitest";
import {
  buildPaymentHistory,
  filterPaymentHistory,
  formatPaymentAmount,
  formatProofDates,
  type PaymentHistoryItem,
} from "./payment-history";

describe("payment history", () => {
  it("lists a receipt once and keeps an older gateway payment", () => {
    const items = buildPaymentHistory(
      [
        {
          id: "proof-1",
          kind: "club",
          amount_centavos: 66405,
          list_centavos: 69900,
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
      reference: "proof-1",
      listCentavos: 69900,
    });
    expect(items[1]).toMatchObject({ status: "paid", reference: "cs_old" });
  });

  it("keeps a declined note and the tournament days", () => {
    const items = buildPaymentHistory(
      [
        {
          id: "proof-2",
          kind: "day",
          amount_centavos: 300000,
          list_centavos: null,
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

  it("filters by kind, status, and a reference with or without hyphens", () => {
    const items: PaymentHistoryItem[] = [
      {
        id: "club",
        reference: "fb4106d4-cde1-4ea0-b738-116d858fa3be",
        createdAt: "2026-11-22T02:49:00.000Z",
        kind: "club",
        amountCentavos: 71910,
        listCentavos: 79900,
        status: "approved",
        datesLabel: null,
        note: null,
        discountCode: "5PERCENT",
      },
      {
        id: "days",
        reference: "7744ebbc-96bc-4a14-b36a-b5ca3fe66817",
        createdAt: "2026-11-22T08:04:00.000Z",
        kind: "day",
        amountCentavos: 405000,
        listCentavos: 450000,
        status: "approved",
        datesLabel: "Dec 18, 2026, Dec 19, 2026, Dec 20, 2026",
        note: null,
        discountCode: "5PERCENT",
      },
      {
        id: "gateway",
        reference: "cs_c9793e99c650cb4e19f0f8e5",
        createdAt: "2026-11-20T17:41:00.000Z",
        kind: "day",
        amountCentavos: 405000,
        listCentavos: null,
        status: "paid",
        datesLabel: null,
        note: null,
        discountCode: null,
      },
    ];

    expect(
      filterPaymentHistory(items, {
        query: "FB4106D4CDE14EA0",
        kind: "all",
        status: "all",
      }).map((item) => item.id),
    ).toEqual(["club"]);
    expect(
      filterPaymentHistory(items, {
        query: "dec 18",
        kind: "tournament",
        status: "approved",
      }).map((item) => item.id),
    ).toEqual(["days"]);
    expect(
      filterPaymentHistory(items, {
        query: "",
        kind: "club",
        status: "paid",
      }),
    ).toEqual([]);
  });

  it("formats a whole peso without centavos", () => {
    expect(formatPaymentAmount(69900)).toBe("₱699");
    expect(formatPaymentAmount(66405)).toBe("₱664.05");
    expect(formatProofDates("2026-02-30")).toBe("2026-02-30");
  });
});
