import { describe, expect, it } from "vitest";
import {
  billingNoticeOpensPlans,
  paymentReceivedCopy,
} from "./billing-messages";

describe("billing notices", () => {
  it("keeps the PayMongo return on the dashboard", () => {
    expect(billingNoticeOpensPlans("success")).toBe(false);
    expect(billingNoticeOpensPlans("cancel")).toBe(false);
    expect(paymentReceivedCopy({ applied: true, kinds: ["club"] })).toBe(
      "Your club month is active.",
    );
    expect(paymentReceivedCopy({ applied: false, kinds: [] })).toMatch(
      /upgrade reminder/,
    );
  });

  it("opens the plans dialog for a checkout problem", () => {
    expect(billingNoticeOpensPlans("checkout")).toBe(true);
    expect(billingNoticeOpensPlans("locked")).toBe(true);
    expect(billingNoticeOpensPlans(undefined)).toBe(false);
  });
});
