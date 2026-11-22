type RealtimeRow = Record<string, unknown> | null | undefined;

export type BillingRealtimeEvent = {
  new?: RealtimeRow;
  old?: RealtimeRow;
};

export const BILLING_REALTIME_TABLES = [
  "facility_billing",
  "tournament_passes",
  "manual_payment_proofs",
] as const;

function rowFromEvent(event: BillingRealtimeEvent): RealtimeRow {
  const next = event.new;
  if (next != null && Object.keys(next).length > 0) return next;
  const previous = event.old;
  if (previous != null && Object.keys(previous).length > 0) return previous;
  return null;
}

/**
 * Realtime is published per table. Ignore another club's row. A payload with
 * no facility id still refreshes, so a partial replica row is not dropped.
 */
export function isFacilityBillingEvent(
  event: BillingRealtimeEvent,
  facilityId: string,
): boolean {
  const row = rowFromEvent(event);
  if (!row) return true;
  const id = row.facility_id;
  return typeof id !== "string" || id === facilityId;
}
