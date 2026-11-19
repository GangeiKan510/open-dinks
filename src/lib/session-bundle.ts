import { facilityFromRow, type FacilityConfig } from "@/lib/facility";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/service";
import { loadFacilityForSession } from "@/lib/facility-server";
import { loadSessionLiveRows } from "@/lib/session-live-rows";

type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
type SessionPlayerRow = Database["public"]["Tables"]["session_players"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type CourtRow = Database["public"]["Tables"]["courts"]["Row"];
type PairingRow = Database["public"]["Tables"]["pairing_history"]["Row"];
type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
type CoachingBookingRow =
  Database["public"]["Tables"]["coaching_bookings"]["Row"];

export type SessionBundle = {
  session: SessionRow;
  players: SessionPlayerRow[];
  matches: MatchRow[];
  courts: CourtRow[];
  pairings: PairingRow[];
  bookings: BookingRow[];
  coachingBookings: CoachingBookingRow[];
  facility: FacilityConfig | null;
  venueTimezone: string;
};

export async function loadSessionBundle(
  token: string,
): Promise<SessionBundle | null> {
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("public_token", token)
    .single();
  if (!session) return null;

  const [rows, { data: venue }, facility] = await Promise.all([
    loadSessionLiveRows(supabase, session),
    supabase
      .from("venues")
      .select("timezone")
      .eq("id", session.venue_id)
      .single(),
    loadFacilityForSession(session.venue_id),
  ]);

  const needsPublicVenue =
    !venue?.timezone || !facility || rows.courts.length === 0;
  const pub = needsPublicVenue
    ? await loadPublicVenueContext(session.venue_id)
    : null;

  return {
    session,
    ...rows,
    courts: rows.courts.length > 0 ? rows.courts : (pub?.courts ?? []),
    facility: facility ?? pub?.facility ?? null,
    venueTimezone: venue?.timezone ?? pub?.timezone ?? "UTC",
  };
}

/**
 * Court names, the club name, and the venue clock are not readable by a
 * signed-out player. Load only those fields. Booking contacts stay on the
 * member query.
 */
async function loadPublicVenueContext(venueId: string): Promise<{
  timezone: string | null;
  facility: FacilityConfig | null;
  courts: CourtRow[];
}> {
  if (!isServiceRoleConfigured()) {
    return { timezone: null, facility: null, courts: [] };
  }

  const service = createServiceClient();
  const [{ data: venue }, { data: courts }] = await Promise.all([
    service
      .from("venues")
      .select("timezone, facility_id")
      .eq("id", venueId)
      .single(),
    service
      .from("courts")
      .select("*")
      .eq("venue_id", venueId)
      .order("sort_order"),
  ]);

  let facility: FacilityConfig | null = null;
  if (venue?.facility_id) {
    const { data: row } = await service
      .from("facilities")
      .select("id, slug, name, short_name, tagline")
      .eq("id", venue.facility_id)
      .single();
    facility = row ? facilityFromRow(row) : null;
  }

  return {
    timezone: venue?.timezone ?? null,
    facility,
    courts: courts ?? [],
  };
}
