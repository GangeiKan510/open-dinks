import { normalizeBookingHours } from "@/lib/booking-hours";
import { createClient } from "@/lib/supabase/server";

/**
 * The one venue an account operates.
 *
 * `venues` is still the row that owns courts, players, sessions, and bookings,
 * but it is no longer a user-facing concept: each account has exactly one and
 * the UI presents it as "the facility". Accounts created before that rule
 * existed may still have several rows, so the oldest always wins to keep the
 * dashboard stable across reloads.
 */
export type AccountVenue = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  facilityId: string;
  bookingOpenHour: number;
  bookingCloseHour: number;
};

type VenueRow = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  facility_id: string;
  booking_open_hour?: number | null;
  booking_close_hour?: number | null;
};

const CORE_VENUE_COLUMNS = "id, name, slug, timezone, facility_id" as const;

function accountVenueFromRow(venue: VenueRow): AccountVenue {
  const hours = normalizeBookingHours({
    openHour: venue.booking_open_hour ?? undefined,
    closeHour: venue.booking_close_hour ?? undefined,
  });

  return {
    id: venue.id,
    name: venue.name,
    slug: venue.slug,
    timezone: venue.timezone,
    facilityId: venue.facility_id,
    bookingOpenHour: hours.openHour,
    bookingCloseHour: hours.closeHour,
  };
}

export async function loadAccountVenue(
  userId: string,
): Promise<AccountVenue | null> {
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("venue_members")
    .select("venue_id")
    .eq("user_id", userId);

  const venueIds = (memberships ?? []).map((m) => m.venue_id);
  if (venueIds.length === 0) return null;

  const { data: venuesWithHours, error: hoursError } = await supabase
    .from("venues")
    .select(`${CORE_VENUE_COLUMNS}, booking_open_hour, booking_close_hour`)
    .in("id", venueIds)
    .order("created_at", { ascending: true })
    .limit(1);

  if (!hoursError && venuesWithHours?.[0]) {
    return accountVenueFromRow(venuesWithHours[0]);
  }

  // Booking-hour columns may be missing until the latest migration is applied.
  const { data: venues } = await supabase
    .from("venues")
    .select(CORE_VENUE_COLUMNS)
    .in("id", venueIds)
    .order("created_at", { ascending: true })
    .limit(1);

  const venue = venues?.[0];
  if (!venue) return null;

  return accountVenueFromRow(venue);
}
