import {
  facilityFromRow,
  slugifyFacilityName,
  type FacilityConfig,
} from "@/lib/facility";
import { createClient } from "@/lib/supabase/server";

/** Resolve facility branding for a venue. */
export async function loadFacilityForVenue(
  venueId: string,
): Promise<FacilityConfig | null> {
  const supabase = await createClient();
  const { data: venue } = await supabase
    .from("venues")
    .select("facility_id")
    .eq("id", venueId)
    .single();

  if (!venue?.facility_id) return null;

  const { data: facility } = await supabase
    .from("facilities")
    .select("id, slug, name, short_name, tagline")
    .eq("id", venue.facility_id)
    .single();

  return facility ? facilityFromRow(facility) : null;
}

/** Resolve facility branding for a live session via its venue. */
export async function loadFacilityForSession(
  venueId: string,
): Promise<FacilityConfig | null> {
  return loadFacilityForVenue(venueId);
}

/**
 * Facility for the logged-in account: first facility among venues they belong to
 * (oldest venue first).
 */
export async function loadFacilityForAccount(
  userId: string,
): Promise<FacilityConfig | null> {
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("venue_members")
    .select("venue_id")
    .eq("user_id", userId);

  const venueIds = (memberships ?? []).map((m) => m.venue_id);
  if (venueIds.length === 0) return null;

  const { data: venues } = await supabase
    .from("venues")
    .select("facility_id, created_at")
    .in("id", venueIds)
    .order("created_at", { ascending: true });

  const facilityId = venues?.find((v) => v.facility_id)?.facility_id;
  if (!facilityId) return null;

  const { data: facility } = await supabase
    .from("facilities")
    .select("id, slug, name, short_name, tagline")
    .eq("id", facilityId)
    .single();

  return facility ? facilityFromRow(facility) : null;
}

/** Create a facility for a new venue (no global default). */
export async function createFacilityForAccount(input: {
  name: string;
  shortName?: string;
  tagline?: string;
}): Promise<string | null> {
  const name = input.name.trim();
  if (!name) return null;

  const shortName = (input.shortName?.trim() || name).slice(0, 32);
  const baseSlug = slugifyFacilityName(name);
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

  const supabase = await createClient();
  const { data: created } = await supabase
    .from("facilities")
    .insert({
      slug,
      name,
      short_name: shortName,
      tagline: input.tagline?.trim() ?? "",
    })
    .select("id")
    .single();

  return created?.id ?? null;
}
