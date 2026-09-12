import type { SupabaseClient } from "@supabase/supabase-js";
import { sessionBookingWindow } from "@/lib/bookings";
import type { Database } from "@/lib/supabase/database.types";

export type AppSupabaseClient = SupabaseClient<Database>;

export async function loadSessionLiveRows(
  supabase: AppSupabaseClient,
  session: { id: string; venue_id: string },
) {
  const bookingWindow = sessionBookingWindow();
  const [
    { data: players },
    { data: matches },
    { data: courts },
    { data: pairings },
    { data: bookings },
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

  return {
    players: players ?? [],
    matches: matches ?? [],
    courts: courts ?? [],
    pairings: pairings ?? [],
    bookings: bookings ?? [],
    coachingBookings: coachingResult.error ? [] : (coachingResult.data ?? []),
  };
}
