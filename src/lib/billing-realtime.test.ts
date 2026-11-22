import { describe, expect, it } from "vitest";
import { isFacilityBillingEvent } from "./billing-realtime";

const facilityId = "11111111-1111-4111-8111-111111111111";

describe("isFacilityBillingEvent", () => {
  it("accepts a billing row for this club", () => {
    expect(
      isFacilityBillingEvent(
        { new: { facility_id: facilityId, club_status: "active" } },
        facilityId,
      ),
    ).toBe(true);
  });

  it("ignores another club", () => {
    expect(
      isFacilityBillingEvent(
        { new: { facility_id: "22222222-2222-4222-8222-222222222222" } },
        facilityId,
      ),
    ).toBe(false);
  });

  it("refreshes when the payload has no facility id", () => {
    expect(isFacilityBillingEvent({ new: {} }, facilityId)).toBe(true);
    expect(isFacilityBillingEvent({}, facilityId)).toBe(true);
  });
});
