/**
 * Host checkout. PayMongo (checkout, webhook, and fulfillment) stays in the
 * codebase. `manual` hides it and takes a GCash receipt instead.
 */
export const PAYMENT_COLLECTION = "manual" as const;

export function collectsManualPayments(): boolean {
  return PAYMENT_COLLECTION === "manual";
}
