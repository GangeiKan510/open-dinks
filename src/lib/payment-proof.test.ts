import { describe, expect, it } from "vitest";
import {
  formatGcashNumber,
  parseGcashNumber,
  pendingReceiptStamp,
  proofImageKind,
  proofRejection,
  proofTypeMatches,
  proofWaiting,
} from "./payment-proof";

function bytes(values: number[], length = 16): Uint8Array {
  const out = new Uint8Array(length);
  values.forEach((value, index) => {
    out[index] = value;
  });
  return out;
}

describe("payment proof images", () => {
  it("accepts jpeg, png, and webp signatures", () => {
    expect(proofImageKind(bytes([0xff, 0xd8, 0xff]))).toBe("jpg");
    expect(proofImageKind(bytes([0x89, 0x50, 0x4e, 0x47]))).toBe("png");
    const webp = bytes([
      0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(proofImageKind(webp)).toBe("webp");
    expect(proofImageKind(bytes([0, 1, 2, 3]))).toBeNull();
    expect(proofImageKind(new Uint8Array(8))).toBeNull();
  });

  it("rejects a file type that disagrees with the bytes", () => {
    expect(proofTypeMatches("jpg", "")).toBe(true);
    expect(proofTypeMatches("jpg", "image/jpeg")).toBe(true);
    expect(proofTypeMatches("png", "image/jpeg")).toBe(false);
  });
});

describe("GCash number", () => {
  it("keeps a local mobile number", () => {
    expect(parseGcashNumber("0917 123 4567")).toBe("09171234567");
    expect(parseGcashNumber("+63 917 123 4567")).toBe("09171234567");
    expect(parseGcashNumber("12345")).toBeNull();
    expect(formatGcashNumber("09171234567")).toBe("0917 123 4567");
  });
});

describe("host proof status", () => {
  const proofs = [
    {
      kind: "club" as const,
      dates: null,
      status: "pending" as const,
      reviewNote: null,
    },
    {
      kind: "day" as const,
      dates: "2026-12-01",
      status: "rejected" as const,
      reviewNote: "Amount does not match.",
    },
  ];

  it("finds a waiting receipt for the same plan", () => {
    expect(proofWaiting(proofs, "club", null)?.status).toBe("pending");
    expect(proofWaiting(proofs, "day", "2026-12-01")).toBeNull();
    expect(proofRejection(proofs, "day")).toBe("Amount does not match.");
    expect(proofRejection(proofs, "club")).toBeNull();
  });
});

describe("pending receipt stamp", () => {
  it("sorts ids so a different row order is the same stamp", () => {
    expect(pendingReceiptStamp(["b", "a", "a", " "])).toBe("a,b");
    expect(pendingReceiptStamp([])).toBe("");
  });
});
