import { describe, expect, it } from "vitest";
import { checkoutDescription } from "./discounts";
import { clubCheckoutBase, tournamentCheckoutBase } from "./checkout-copy";

describe("checkout breakdown", () => {
  it("names the club month and the peso amount", () => {
    expect(clubCheckoutBase()).toBe(
      "Picklrz Club month: open play and booking, ₱699.",
    );
  });

  it("shows the day rate and each date", () => {
    expect(tournamentCheckoutBase(["2026-11-20"])).toBe(
      "Picklrz tournament: 1 day × ₱1,500 on 2026-11-20.",
    );
    expect(
      tournamentCheckoutBase(["2026-11-20", "2026-11-22", "2026-11-25"]),
    ).toBe(
      "Picklrz tournament: 3 days × ₱1,500 on 2026-11-20, 2026-11-22, 2026-11-25.",
    );
  });

  it("names the volume rate once four days are in one purchase", () => {
    expect(
      tournamentCheckoutBase([
        "2026-11-20",
        "2026-11-21",
        "2026-11-22",
        "2026-11-23",
      ]),
    ).toBe(
      "Picklrz tournament: 4 days × ₱1,400 (₱1,500 a day through 3) on 2026-11-20, 2026-11-21, 2026-11-22, 2026-11-23.",
    );
  });

  it("keeps the list price in the description when a code lowers the charge", () => {
    const base = tournamentCheckoutBase([
      "2026-11-20",
      "2026-11-22",
      "2026-11-25",
    ]);
    expect(
      checkoutDescription({
        base,
        listCentavos: 450000,
        dueCentavos: 405000,
        code: "EARLY",
      }),
    ).toBe(
      "Picklrz tournament: 3 days × ₱1,500 on 2026-11-20, 2026-11-22, 2026-11-25. ₱4,500 less ₱450 with EARLY.",
    );
  });
});
