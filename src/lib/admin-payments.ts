export type PaymentQueueSort = "oldest" | "newest" | "facility";

export function parsePaymentQueueSort(
  value: string | undefined,
): PaymentQueueSort {
  if (value === "newest" || value === "facility") return value;
  return "oldest";
}

export function filterPaymentQueue<
  T extends { id: string; facilityName: string },
>(proofs: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return proofs;
  const compact = needle.replace(/-/g, "");
  return proofs.filter((proof) => {
    const id = proof.id.toLowerCase();
    const name = proof.facilityName.toLowerCase();
    return (
      name.includes(needle) ||
      id.includes(needle) ||
      (compact.length > 0 && id.replace(/-/g, "").includes(compact))
    );
  });
}

export function sortPaymentQueue<
  T extends { id: string; facilityName: string; createdAt: string },
>(proofs: T[], sort: PaymentQueueSort): T[] {
  const ranked = proofs.map((proof) => {
    const at = new Date(proof.createdAt).getTime();
    return { proof, at: Number.isNaN(at) ? 0 : at };
  });
  ranked.sort((a, b) => {
    if (sort === "facility") {
      const byName = a.proof.facilityName.localeCompare(
        b.proof.facilityName,
        "en",
        { sensitivity: "base" },
      );
      if (byName !== 0) return byName;
    }
    const byTime = sort === "newest" ? b.at - a.at : a.at - b.at;
    if (byTime !== 0) return byTime;
    return a.proof.id.localeCompare(b.proof.id);
  });
  return ranked.map(({ proof }) => proof);
}
