import { describe, expect, it } from "vitest";
import {
  filterPaymentQueue,
  parsePaymentQueueSort,
  sortPaymentQueue,
} from "./admin-payments";

const proofs = [
  {
    id: "fb4106d4-cde1-4ea0-b738-116d858fa3be",
    facilityName: "Test Account Facility",
    createdAt: "2026-11-22T14:49:00.000Z",
  },
  {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    facilityName: "North Club",
    createdAt: "2026-11-20T01:00:00.000Z",
  },
  {
    id: "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
    facilityName: "north club annex",
    createdAt: "2026-11-21T01:00:00.000Z",
  },
];

describe("payment queue", () => {
  it("matches a reference with or without hyphens, and a facility name", () => {
    expect(filterPaymentQueue(proofs, "").map((proof) => proof.id)).toEqual(
      proofs.map((proof) => proof.id),
    );
    expect(
      filterPaymentQueue(proofs, "fb4106d4").map((proof) => proof.id),
    ).toEqual([proofs[0]?.id]);
    expect(
      filterPaymentQueue(proofs, "FB4106D4CDE14EA0").map((proof) => proof.id),
    ).toEqual([proofs[0]?.id]);
    expect(
      filterPaymentQueue(proofs, "north").map((proof) => proof.facilityName),
    ).toEqual(["North Club", "north club annex"]);
    expect(filterPaymentQueue(proofs, "missing")).toEqual([]);
  });

  it("sorts by time or facility and keeps a stable tie break", () => {
    expect(parsePaymentQueueSort(undefined)).toBe("oldest");
    expect(parsePaymentQueueSort("nope")).toBe("oldest");
    expect(parsePaymentQueueSort("newest")).toBe("newest");

    expect(
      sortPaymentQueue(proofs, "oldest").map((proof) => proof.facilityName),
    ).toEqual(["North Club", "north club annex", "Test Account Facility"]);
    expect(
      sortPaymentQueue(proofs, "newest").map((proof) => proof.facilityName),
    ).toEqual(["Test Account Facility", "north club annex", "North Club"]);
    expect(
      sortPaymentQueue(proofs, "facility").map((proof) => proof.facilityName),
    ).toEqual(["North Club", "north club annex", "Test Account Facility"]);
  });
});
