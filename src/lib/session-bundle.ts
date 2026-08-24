import type { FacilityConfig } from "@/lib/facility";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { loadFacilityForSession } from "@/lib/facility-server";

type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
type SessionPlayerRow = Database["public"]["Tables"]["session_players"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type CourtRow = Database["public"]["Tables"]["courts"]["Row"];
type PairingRow = Database["public"]["Tables"]["pairing_history"]["Row"];

export type SessionBundle = {
  session: SessionRow;
  players: SessionPlayerRow[];
  matches: MatchRow[];
  courts: CourtRow[];
  pairings: PairingRow[];
  facility: FacilityConfig | null;
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

  const [
    { data: players },
    { data: matches },
    { data: courts },
    { data: pairings },
    facility,
  ] = await Promise.all([
    supabase.from("session_players").select("*").eq("session_id", session.id),
    supabase.from("matches").select("*").eq("session_id", session.id),
    supabase
      .from("courts")
      .select("*")
      .eq("venue_id", session.venue_id)
      .order("sort_order"),
    supabase.from("pairing_history").select("*").eq("session_id", session.id),
    loadFacilityForSession(session.venue_id),
  ]);

  return {
    session,
    players: players ?? [],
    matches: matches ?? [],
    courts: courts ?? [],
    pairings: pairings ?? [],
    facility,
  };
}
