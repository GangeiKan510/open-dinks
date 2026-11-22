import type { SupabaseClient } from "@supabase/supabase-js";
import { sessionBookingWindow } from "@/lib/bookings";
import {
  bookingsFromPublicBusyRanges,
  isBookingReadDenied,
} from "@/lib/public-session-holds";
import type { Database } from "@/lib/supabase/database.types";

export type AppSupabaseClient = SupabaseClient<Database>;

export async function loadSessionLiveRows(
  supabase: AppSupabaseClient,
  session: { id: string; venue_id: string },
  options?: { blockCourtsOnBookingError?: boolean },
) {
  const bookingWindow = sessionBookingWindow();
  const [
    { data: players },
    { data: matches },
    { data: courts },
    { data: pairings },
    bookingsResult,
    coachingResult,
  ] = await Promise.all([
    supabase.from("session_players").select("*").eq("session_id", session.id),
    supabase.from("matches").select("*").eq("session_id", session.id),
    supabase
      .from("courts")
      .select("*")
      .eq("venue_id", session.venue_id)
      .order("sort_order"),
    supabase.from("pairing_history").select("*").eq("session_id", session.id),
    supabase
      .from("bookings")
      .select("*")
      .eq("venue_id", session.venue_id)
      .eq("status", "confirmed")
      .gt("ends_at", bookingWindow.from)
      .lt("starts_at", bookingWindow.to)
      .order("starts_at"),
    supabase
      .from("coaching_bookings")
      .select("*")
      .eq("venue_id", session.venue_id)
      .eq("status", "confirmed")
      .gt("ends_at", bookingWindow.from)
      .lt("starts_at", bookingWindow.to)
      .order("starts_at"),
  ]);

  // A missing grant is the signed-out case: show the court as reserved without
  // the booker's name. Any other failure stays stale so a host refresh does
  // not replace real names with "Reserved". The host save path can still block
  // the court from those public times.
  const denied =
    bookingsResult.error != null && isBookingReadDenied(bookingsResult.error);
  const blockOnError =
    bookingsResult.error != null && options?.blockCourtsOnBookingError;
  const bookings =
    denied || blockOnError
      ? await publicCourtHolds(supabase, session.venue_id, bookingWindow)
      : (bookingsResult.data ?? []);

  return {
    players: players ?? [],
    matches: matches ?? [],
    courts: courts ?? [],
    pairings: pairings ?? [],
    bookings,
    bookingsFresh: bookingsResult.error == null || denied || blockOnError,
    coachingBookings: coachingResult.error ? [] : (coachingResult.data ?? []),
  };
}

async function publicCourtHolds(
  supabase: AppSupabaseClient,
  venueId: string,
  bookingWindow: { from: string; to: string },
) {
  const { data } = await supabase.rpc("get_court_busy_ranges", {
    p_venue_id: venueId,
    p_from: bookingWindow.from,
    p_to: bookingWindow.to,
  });
  return bookingsFromPublicBusyRanges(venueId, data ?? []);
}
