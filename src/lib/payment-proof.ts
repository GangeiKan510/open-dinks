export const PAYMENT_PROOF_BUCKET = "payment-proofs";
export const MAX_PAYMENT_PROOF_BYTES = 5 * 1024 * 1024;

export type ProofImageKind = "jpg" | "png" | "webp";

const CONTENT_TYPES: Record<ProofImageKind, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function proofContentType(kind: ProofImageKind): string {
  return CONTENT_TYPES[kind];
}

/** Sniff the image. A renamed file is not a receipt. */
export function proofImageKind(bytes: Uint8Array): ProofImageKind | null {
  if (bytes.length < 12 || bytes.length > MAX_PAYMENT_PROOF_BYTES) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (riff === "RIFF" && webp === "WEBP") return "webp";
  return null;
}

/** Empty browser types are accepted. A stated type must match the bytes. */
export function proofTypeMatches(
  kind: ProofImageKind,
  fileType: string,
): boolean {
  const stated = fileType.trim().toLowerCase();
  if (!stated) return true;
  if (kind === "jpg") return stated === "image/jpeg" || stated === "image/jpg";
  return stated === CONTENT_TYPES[kind];
}

/** 09xxxxxxxxx, or 639xxxxxxxxx / +639xxxxxxxxx. */
export function parseGcashNumber(value: string | undefined): string | null {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("63")) {
    return `0${digits.slice(2)}`;
  }
  if (digits.length === 11 && digits.startsWith("09")) return digits;
  return null;
}

export function formatGcashNumber(number: string): string {
  return `${number.slice(0, 4)} ${number.slice(4, 7)} ${number.slice(7)}`;
}

export function gcashPayee(): { number: string; name: string } | null {
  const number = parseGcashNumber(process.env.GCASH_NUMBER);
  if (!number) return null;
  const name = (process.env.GCASH_ACCOUNT_NAME ?? "").trim().slice(0, 80);
  return { number, name };
}

export type HostProof = {
  kind: "club" | "day";
  dates: string | null;
  status: "pending" | "rejected";
  reviewNote: string | null;
};

export function proofWaiting(
  proofs: HostProof[],
  kind: "club" | "day",
  dates: string | null,
): HostProof | null {
  return (
    proofs.find(
      (proof) =>
        proof.status === "pending" &&
        proof.kind === kind &&
        (kind === "club" || proof.dates === dates),
    ) ?? null
  );
}

export function proofRejection(
  proofs: HostProof[],
  kind: "club" | "day",
): string | null {
  if (proofWaiting(proofs, kind, kind === "club" ? null : "")) return null;
  const rejected = proofs.find(
    (proof) => proof.status === "rejected" && proof.kind === kind,
  );
  const note = rejected?.reviewNote?.trim() ?? "";
  return note || null;
}
