import {
  facilityFromRow,
  slugifyFacilityName,
  type FacilityConfig,
} from "@/lib/facility";
import { createClient } from "@/lib/supabase/server";
import { loadAccountVenue } from "@/lib/account-venue";

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

/** Facility branding for the logged-in account's single venue. */
export async function loadFacilityForAccount(
  userId: string,
): Promise<FacilityConfig | null> {
  const venue = await loadAccountVenue(userId);
  if (!venue?.facilityId) return null;

  const supabase = await createClient();
  const { data: facility } = await supabase
    .from("facilities")
    .select("id, slug, name, short_name, tagline")
    .eq("id", venue.facilityId)
    .single();

  return facility ? facilityFromRow(facility) : null;
}

/** Create a facility for a new venue (no global default). */
export async function createFacilityForAccount(input: {
  name: string;
  shortName?: string;
  tagline?: string;
}): Promise<{ id: string } | { error: string }> {
  const name = input.name.trim();
  if (!name) return { error: "Facility name is required." };

  const shortName = (input.shortName?.trim() || name).slice(0, 32);
  const baseSlug = slugifyFacilityName(name);
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("facilities")
    .insert({
      slug,
      name,
      short_name: shortName,
      tagline: input.tagline?.trim() ?? "",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[facility] create failed", error);
    const message = error.message.toLowerCase();
    if (
      message.includes("does not exist") ||
      message.includes("schema cache") ||
      error.code === "42P01" ||
      error.code === "PGRST205"
    ) {
      return {
        error:
          "Facilities table is missing. Run the latest Supabase migrations, then try again.",
      };
    }
    return { error: "Could not create facility. Try again." };
  }

  if (!created?.id) {
    return { error: "Could not create facility. Try again." };
  }

  return { id: created.id };
}
