import { describe, expect, it } from "vitest";
import {
  billingNoticeOpensPlans,
  pathWithoutSearchParam,
  paymentReceivedCopy,
  clubPlanStatusCopy,
  openPlayPausedCopy,
  receiptSentCopy,
} from "./billing-messages";

describe("billing notices", () => {
  it("keeps the PayMongo return on the dashboard", () => {
    expect(billingNoticeOpensPlans("success")).toBe(false);
    expect(billingNoticeOpensPlans("cancel")).toBe(false);
    expect(paymentReceivedCopy({ applied: true, kinds: ["club"] })).toBe(
      "Your club month is active.",
    );
    expect(paymentReceivedCopy({ applied: true, kinds: ["day"] })).toBe(
      "Tournament mode is open. Brackets can be built on the days you bought.",
    );
    expect(paymentReceivedCopy({ applied: false, kinds: [] })).toMatch(
      /upgrade reminder/,
    );
    expect(receiptSentCopy("club")).toBe(
      "You have successfully sent your payment. An admin will check the receipt and open the club month.",
    );
    expect(receiptSentCopy("day")).toBe(
      "You have successfully sent your payment. An admin will check the receipt and open those tournament days.",
    );
    expect(clubPlanStatusCopy(true)).toBe(
      "Club plan opens once an admin approves the payment.",
    );
    expect(clubPlanStatusCopy(false)).toBe("Club plan paused");
    expect(
      openPlayPausedCopy({
        pendingApproval: true,
        liveSession: false,
        trialAvailable: true,
      }),
    ).toEqual({
      title: "Open play opens with the club plan",
      detail:
        "An admin will open the club month after checking the receipt. Open play stays closed until then.",
    });
    expect(
      openPlayPausedCopy({
        pendingApproval: false,
        liveSession: true,
        trialAvailable: true,
      }).detail,
    ).toBe(
      "Start the free trial or pay for a club month to run open play. End the session that is still marked live. The console stays closed until the club plan is active.",
    );
    expect(
      openPlayPausedCopy({
        pendingApproval: false,
        liveSession: false,
        trialAvailable: false,
      }).detail,
    ).toBe("Pay for a club month to run open play.");
  });

  it("drops the billing return code and keeps the rest of the address", () => {
    expect(
      pathWithoutSearchParam(
        "http://localhost:3000/dashboard?billing=success",
        "billing",
      ),
    ).toBe("/dashboard");
    expect(
      pathWithoutSearchParam(
        "/dashboard?plans=open&billing=success",
        "billing",
      ),
    ).toBe("/dashboard?plans=open");
    expect(
      pathWithoutSearchParam("/dashboard?billing=cancel#courts", "billing"),
    ).toBe("/dashboard#courts");
  });

  it("opens the plans dialog for a checkout problem", () => {
    expect(billingNoticeOpensPlans("checkout")).toBe(true);
    expect(billingNoticeOpensPlans("code")).toBe(true);
    expect(billingNoticeOpensPlans("locked")).toBe(true);
    expect(billingNoticeOpensPlans("proof")).toBe(false);
    expect(billingNoticeOpensPlans("proof-file")).toBe(true);
    expect(billingNoticeOpensPlans("proof-large")).toBe(true);
    expect(billingNoticeOpensPlans("proof-pending")).toBe(true);
    expect(billingNoticeOpensPlans("proof-save")).toBe(true);
    expect(billingNoticeOpensPlans(undefined)).toBe(false);
  });
});
