"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadAccountVenue } from "@/lib/account-venue";
import { createFacilityForAccount } from "@/lib/facility-server";
import {
  buildCourtNames,
  DEFAULT_COURT_COUNT,
  normalizeCourtCount,
  planCourtCountChange,
} from "@/lib/court-count";
import { slugifyFacilityName } from "@/lib/facility";
import { parseBookingHoursForm } from "@/lib/booking-hours";
import { parseVenueTimezone } from "@/lib/timezone";
import {
  FACILITY_ERROR_MESSAGES,
  formatCourtInUseMessage,
  type CourtInUseReason,
} from "@/lib/facility-messages";

export type FacilityActionResult = { error: string } | { ok: true };

/**
 * One-time setup: creates the account's facility, its backing venue, the owner
 * membership, and the initial courts. Accounts get exactly one facility, so
 * this is a no-op once a venue already exists.
 */
export async function createFacilityAction(
  formData: FormData,
): Promise<FacilityActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: FACILITY_ERROR_MESSAGES.name };

  const courtCount = normalizeCourtCount(
    formData.get("courtCount"),
    DEFAULT_COURT_COUNT,
  );

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: FACILITY_ERROR_MESSAGES.signIn };

  const existing = await loadAccountVenue(user.id);
  if (existing) {
    revalidatePath("/dashboard");
    redirect("/dashboard");
  }

  // venues.created_by needs a profiles row; the auth trigger usually made it.
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    display_name:
      user.user_metadata?.display_name || user.email?.split("@")[0] || "Host",
  });
  if (profileError) {
    console.error("[facility] profile upsert failed", profileError);
    return { error: FACILITY_ERROR_MESSAGES.profile };
  }

  const facility = await createFacilityForAccount({ name });
  if ("error" in facility) return { error: facility.error };

  const slugBase = slugifyFacilityName(name);
  const slug = `${slugBase}-${Math.random().toString(36).slice(2, 6)}`;
  const venueId = crypto.randomUUID();

  const { error: venueError } = await supabase.from("venues").insert({
    id: venueId,
    name,
    slug,
    timezone: parseVenueTimezone(formData.get("timezone")),
    created_by: user.id,
    facility_id: facility.id,
  });
  if (venueError) {
    console.error("[facility] venue insert failed", venueError);
    const message = (venueError.message ?? "").toLowerCase();
    if (
      message.includes("facility_id") ||
      message.includes("does not exist") ||
      message.includes("schema cache")
    ) {
      return { error: FACILITY_ERROR_MESSAGES.schema };
    }
    return { error: FACILITY_ERROR_MESSAGES.create };
  }

  const { error: memberError } = await supabase.from("venue_members").insert({
    venue_id: venueId,
    user_id: user.id,
    role: "owner",
  });
  if (memberError) {
    console.error("[facility] member insert failed", memberError);
    return { error: FACILITY_ERROR_MESSAGES.create };
  }

  const courts = buildCourtNames(courtCount).map((courtName, index) => ({
    venue_id: venueId,
    name: courtName,
    sort_order: index + 1,
  }));
  const { error: courtsError } = await supabase.from("courts").insert(courts);
  if (courtsError) {
    console.error("[facility] courts insert failed", courtsError);
    return { error: FACILITY_ERROR_MESSAGES.courts };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function updateFacilityBrandingAction(
  formData: FormData,
): Promise<FacilityActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const shortName = String(formData.get("shortName") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim();
  if (!name || !shortName) return { error: FACILITY_ERROR_MESSAGES.name };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: FACILITY_ERROR_MESSAGES.signIn };

  const venue = await loadAccountVenue(user.id);
  if (!venue) return { error: FACILITY_ERROR_MESSAGES.noFacility };

  const { error } = await supabase
    .from("facilities")
    .update({ name, short_name: shortName, tagline })
    .eq("id", venue.facilityId);
  if (error) {
    console.error("[facility] branding update failed", error);
    return { error: FACILITY_ERROR_MESSAGES.save };
  }

  // The venue name is internal but mirrors the facility so admin queries match.
  await supabase.from("venues").update({ name }).eq("id", venue.id);

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateVenueTimezoneAction(
  formData: FormData,
): Promise<FacilityActionResult> {
  const timezone = parseVenueTimezone(formData.get("timezone"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: FACILITY_ERROR_MESSAGES.signIn };

  const venue = await loadAccountVenue(user.id);
  if (!venue) return { error: FACILITY_ERROR_MESSAGES.noFacility };

  const { error } = await supabase
    .from("venues")
    .update({ timezone })
    .eq("id", venue.id);
  if (error) {
    console.error("[facility] timezone update failed", error);
    return { error: FACILITY_ERROR_MESSAGES.save };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/book/${venue.slug}`);
  return { ok: true };
}

export async function updateVenueBookingHoursAction(
  formData: FormData,
): Promise<FacilityActionResult> {
  const open24Hours = formData.get("open24Hours") === "on";
  const parsed = parseBookingHoursForm(
    formData.get("bookingOpenHour"),
    formData.get("bookingCloseHour"),
    open24Hours,
  );
  if (parsed === "invalid") {
    return { error: FACILITY_ERROR_MESSAGES.bookingHours };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: FACILITY_ERROR_MESSAGES.signIn };

  const venue = await loadAccountVenue(user.id);
  if (!venue) return { error: FACILITY_ERROR_MESSAGES.noFacility };

  const { error } = await supabase
    .from("venues")
    .update({
      booking_open_hour: parsed.openHour,
      booking_close_hour: parsed.closeHour,
    })
    .eq("id", venue.id);
  if (error) {
    console.error("[facility] booking hours update failed", error);
    return { error: FACILITY_ERROR_MESSAGES.save };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/book/${venue.slug}`);
  return { ok: true };
}

/**
 * Grow or shrink the facility's courts. Courts are trimmed from the end and a
 * court that is booked or mid-game is never removed.
 */
export async function setCourtCountAction(
  formData: FormData,
): Promise<FacilityActionResult> {
  const target = normalizeCourtCount(
    formData.get("courtCount"),
    DEFAULT_COURT_COUNT,
  );

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: FACILITY_ERROR_MESSAGES.signIn };

  const venue = await loadAccountVenue(user.id);
  if (!venue) return { error: FACILITY_ERROR_MESSAGES.noFacility };

  const { data: courtRows } = await supabase
    .from("courts")
    .select("id, name, sort_order")
    .eq("venue_id", venue.id);

  const plan = planCourtCountChange(courtRows ?? [], target);
  if (plan.toAdd.length === 0 && plan.toRemove.length === 0) {
    return { ok: true };
  }

  if (plan.toRemove.length > 0) {
    const removeIds = plan.toRemove.map((court) => court.id);
    const blocked = await findCourtInUse(venue.id, removeIds);
    if (blocked) {
      const court = plan.toRemove.find((c) => c.id === blocked.courtId);
      return {
        error: formatCourtInUseMessage(
          court?.name ?? "That court",
          blocked.reason,
        ),
      };
    }

    const { error } = await supabase
      .from("courts")
      .delete()
      .in("id", removeIds);
    if (error) {
      console.error("[facility] court delete failed", error);
      return { error: FACILITY_ERROR_MESSAGES.courts };
    }
  }

  if (plan.toAdd.length > 0) {
    const { error } = await supabase.from("courts").insert(
      plan.toAdd.map((court) => ({
        venue_id: venue.id,
        name: court.name,
        sort_order: court.sort_order,
      })),
    );
    if (error) {
      console.error("[facility] court insert failed", error);
      return { error: FACILITY_ERROR_MESSAGES.courts };
    }
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

/** First court in `courtIds` that has a live booking or an occupied match. */
async function findCourtInUse(
  venueId: string,
  courtIds: string[],
): Promise<{ courtId: string; reason: CourtInUseReason } | null> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const { data: bookings } = await supabase
    .from("bookings")
    .select("court_id")
    .in("court_id", courtIds)
    .neq("status", "cancelled")
    .gt("ends_at", nowIso)
    .limit(1);

  if (bookings && bookings.length > 0) {
    return { courtId: bookings[0].court_id, reason: "booked" };
  }

  const { data: liveSessions } = await supabase
    .from("sessions")
    .select("id")
    .eq("venue_id", venueId)
    .eq("status", "live");

  const liveSessionIds = (liveSessions ?? []).map((s) => s.id);
  if (liveSessionIds.length === 0) return null;

  const { data: matches } = await supabase
    .from("matches")
    .select("court_id")
    .in("session_id", liveSessionIds)
    .in("court_id", courtIds)
    .in("status", ["ready", "active"])
    .limit(1);

  const courtId = matches?.[0]?.court_id;
  return courtId ? { courtId, reason: "playing" } : null;
}
