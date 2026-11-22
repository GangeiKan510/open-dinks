import { describe, expect, it } from "vitest";
import {
  formatCentavos,
  paymentAmountCentavos,
  summarizeSales,
  type SaleRecord,
} from "./admin-sales";

const NOW = new Date("2026-11-18T02:00:00.000Z");

function sale(overrides: Partial<SaleRecord>): SaleRecord {
  return {
    checkoutId: "cs_1",
    facilityName: "PicklePlace",
    kind: "club",
    amountCentavos: 69900,
    createdAt: "2026-11-02T02:00:00.000Z",
    ...overrides,
  };
}

describe("sales", () => {
  it("uses the stored centavos and falls back to the catalog price", () => {
    expect(paymentAmountCentavos({ kind: "club", amountCentavos: 50000 })).toBe(
      50000,
    );
    expect(paymentAmountCentavos({ kind: "club", amountCentavos: null })).toBe(
      79900,
    );
    expect(paymentAmountCentavos({ kind: "day", amountCentavos: null })).toBe(
      200000,
    );
    expect(
      paymentAmountCentavos({ kind: "weekend", amountCentavos: null }),
    ).toBe(400000);
    expect(formatCentavos(69900)).toBe("₱699");
    expect(formatCentavos(150000)).toBe("₱1,500");
  });

  it("totals every payment and isolates the Manila month", () => {
    const summary = summarizeSales(
      [
        sale({ checkoutId: "club", kind: "club", amountCentavos: null }),
        sale({
          checkoutId: "day",
          kind: "day",
          amountCentavos: 150000,
          createdAt: "2026-11-10T02:00:00.000Z",
        }),
        sale({
          checkoutId: "old",
          kind: "weekend",
          amountCentavos: 400000,
          createdAt: "2026-10-15T02:00:00.000Z",
        }),
      ],
      NOW,
    );

    expect(summary.totalCentavos).toBe(79900 + 150000 + 400000);
    expect(summary.monthCentavos).toBe(79900 + 150000);
    expect(summary.byKind.club).toEqual({ count: 1, centavos: 79900 });
    expect(summary.byKind.day).toEqual({ count: 1, centavos: 150000 });
    expect(summary.byKind.weekend).toEqual({ count: 1, centavos: 400000 });
  });
});
