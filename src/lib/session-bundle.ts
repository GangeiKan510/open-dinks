import type { FacilityConfig } from "@/lib/facility";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
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

  return {
    session,
    ...rows,
    facility,
    venueTimezone: venue?.timezone ?? "UTC",
  };
}
