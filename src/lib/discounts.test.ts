import { describe, expect, it } from "vitest";
import {
  chargeCentavos,
  checkoutDescription,
  discountSummary,
  listCentavosForDiscount,
  normalizeDiscountCode,
  parseDiscountDraft,
  priceWithDiscount,
  type DiscountOffer,
} from "./discounts";

function offer(overrides: Partial<DiscountOffer> = {}): DiscountOffer {
  return {
    id: "code-1",
    code: "EARLY",
    appliesTo: "any",
    percentOff: 10,
    amountOffCentavos: null,
    active: true,
    expiresOn: null,
    maxRedemptions: null,
    redemptionCount: 0,
    ...overrides,
  };
}

describe("discount codes", () => {
  it("normalizes a code and rejects a short or spaced one", () => {
    expect(normalizeDiscountCode(" early ")).toBe("EARLY");
    expect(normalizeDiscountCode("")).toBeNull();
    expect(normalizeDiscountCode("ab")).toBeNull();
    expect(normalizeDiscountCode("EAR LY")).toBeNull();
  });

  it("takes 10% off a club month and keeps the centavos exact", () => {
    const quote = priceWithDiscount({
      product: "club",
      listCentavos: 69900,
      today: "2026-11-20",
      offer: offer(),
    });
    expect(quote).toEqual({ dueCentavos: 62910, offCentavos: 6990 });
    expect(
      discountSummary({
        listCentavos: 69900,
        dueCentavos: 62910,
        code: "EARLY",
      }),
    ).toBe("₱699 less ₱69.90 with EARLY. You pay ₱629.10.");
    expect(
      checkoutDescription({
        base: "One month of open play and booking",
        listCentavos: 69900,
        dueCentavos: 62910,
        code: "EARLY",
      }),
    ).toBe("One month of open play and booking. ₱699 less ₱69.90 with EARLY.");
    expect(
      checkoutDescription({
        base: "Picklrz Club month: open play and booking, ₱699.",
        listCentavos: 69900,
        dueCentavos: 62910,
        code: "EARLY",
      }),
    ).toBe(
      "Picklrz Club month: open play and booking, ₱699. ₱699 less ₱69.90 with EARLY.",
    );
  });

  it("recovers the list price from the amount that was paid", () => {
    expect(
      listCentavosForDiscount({
        dueCentavos: 71910,
        percentOff: 10,
        amountOffCentavos: null,
      }),
    ).toBe(79900);
    expect(
      listCentavosForDiscount({
        dueCentavos: 66405,
        percentOff: 5,
        amountOffCentavos: null,
      }),
    ).toBe(69900);
    expect(
      listCentavosForDiscount({
        dueCentavos: 400000,
        percentOff: null,
        amountOffCentavos: 50000,
      }),
    ).toBe(450000);
    expect(
      listCentavosForDiscount({
        dueCentavos: 1,
        percentOff: 5,
        amountOffCentavos: null,
      }),
    ).toBeNull();
  });

  it("takes a fixed peso amount off tournament days", () => {
    expect(
      priceWithDiscount({
        product: "day",
        listCentavos: 450000,
        today: "2026-11-20",
        offer: offer({
          appliesTo: "day",
          percentOff: null,
          amountOffCentavos: 50000,
        }),
      }),
    ).toEqual({ dueCentavos: 400000, offCentavos: 50000 });
  });

  it("rejects a code for the wrong product, an expired code, and a used-up code", () => {
    const today = "2026-11-20";
    expect(
      priceWithDiscount({
        product: "club",
        listCentavos: 69900,
        today,
        offer: offer({ appliesTo: "day" }),
      }),
    ).toBeNull();
    expect(
      priceWithDiscount({
        product: "club",
        listCentavos: 69900,
        today,
        offer: offer({ expiresOn: "2026-11-19" }),
      }),
    ).toBeNull();
    expect(
      priceWithDiscount({
        product: "club",
        listCentavos: 69900,
        today,
        offer: offer({ maxRedemptions: 1, redemptionCount: 1 }),
      }),
    ).toBeNull();
    expect(
      priceWithDiscount({
        product: "club",
        listCentavos: 69900,
        today,
        offer: offer({ active: false }),
      }),
    ).toBeNull();
  });

  it("rejects a discount that would drop the charge below ₱20", () => {
    expect(
      priceWithDiscount({
        product: "club",
        listCentavos: 69900,
        today: "2026-11-20",
        offer: offer({ percentOff: 99, amountOffCentavos: null }),
      }),
    ).toBeNull();
  });

  it("trusts a quoted checkout amount and ignores a quote above the list price", () => {
    expect(chargeCentavos({ listCentavos: 69900 })).toBe(69900);
    expect(
      chargeCentavos({ listCentavos: 69900, quotedCentavos: "62910" }),
    ).toBe(62910);
    expect(
      chargeCentavos({ listCentavos: 69900, quotedCentavos: "70000" }),
    ).toBeNull();
    expect(
      chargeCentavos({ listCentavos: 69900, quotedCentavos: "100" }),
    ).toBeNull();
  });

  it("parses an operator draft", () => {
    expect(
      parseDiscountDraft({
        code: "early",
        appliesTo: "any",
        mode: "amount",
        value: "100",
        expiresOn: "",
        maxRedemptions: "5",
      }),
    ).toEqual({
      ok: true,
      draft: {
        code: "EARLY",
        appliesTo: "any",
        percentOff: null,
        amountOffCentavos: 10000,
        expiresOn: null,
        maxRedemptions: 5,
      },
    });
    expect(
      parseDiscountDraft({
        code: "nope",
        appliesTo: "club",
        mode: "percent",
        value: "100",
        expiresOn: "",
        maxRedemptions: "",
      }).ok,
    ).toBe(false);
  });
});
