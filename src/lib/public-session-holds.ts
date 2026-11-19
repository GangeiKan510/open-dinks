import type { Database } from "@/lib/supabase/database.types";

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];

/** Shown when the viewer cannot read who booked the court. */
export const PUBLIC_COURT_HOLD_LABEL = "Reserved";

/** True when Postgres or PostgREST refused the bookings read. */
export function isBookingReadDenied(error: {
  code?: string;
  message?: string;
}): boolean {
  const code = error.code ?? "";
  if (code === "42501" || code === "PGRST301") return true;
  return /permission denied/i.test(error.message ?? "");
}

export type PublicBusyRange = {
  court_id: string;
  starts_at: string;
  ends_at: string;
};

/**
 * Court holds for a signed-out viewer. Times only — no name, email, or phone.
 */
export function bookingsFromPublicBusyRanges(
  venueId: string,
  ranges: PublicBusyRange[],
): BookingRow[] {
  return ranges.map((range) => ({
    id: `hold-${range.court_id}-${range.starts_at}`,
    venue_id: venueId,
    court_id: range.court_id,
    starts_at: range.starts_at,
    ends_at: range.ends_at,
    status: "confirmed",
    booked_by_name: PUBLIC_COURT_HOLD_LABEL,
    contact_email: null,
    contact_phone: null,
    notes: null,
    price_cents: null,
    payment_status: "unpaid",
    source: "public",
    created_by: null,
    created_at: range.starts_at,
    updated_at: range.starts_at,
    public_token: "",
    decline_reason: null,
  }));
}
