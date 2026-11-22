import { describe, expect, it } from "vitest";
import { checkoutDescription } from "./discounts";
import { clubCheckoutBase, tournamentCheckoutBase } from "./checkout-copy";

describe("checkout breakdown", () => {
  it("names the club month and the peso amount", () => {
    expect(clubCheckoutBase()).toBe(
      "Picklrz Club month: open play and booking, ₱799.",
    );
  });

  it("shows the day rate and each date", () => {
    expect(tournamentCheckoutBase(["2026-11-20"])).toBe(
      "Picklrz tournament: 1 day × ₱2,000 on 2026-11-20.",
    );
    expect(
      tournamentCheckoutBase(["2026-11-20", "2026-11-22", "2026-11-25"]),
    ).toBe(
      "Picklrz tournament: 3 days × ₱2,000 on 2026-11-20, 2026-11-22, 2026-11-25.",
    );
  });

  it("keeps the same day rate for a four-day purchase", () => {
    expect(
      tournamentCheckoutBase([
        "2026-11-20",
        "2026-11-21",
        "2026-11-22",
        "2026-11-23",
      ]),
    ).toBe(
      "Picklrz tournament: 4 days × ₱2,000 on 2026-11-20, 2026-11-21, 2026-11-22, 2026-11-23.",
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
        listCentavos: 600000,
        dueCentavos: 540000,
        code: "EARLY",
      }),
    ).toBe(
      "Picklrz tournament: 3 days × ₱2,000 on 2026-11-20, 2026-11-22, 2026-11-25. ₱6,000 less ₱600 with EARLY.",
    );
  });
});
