"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  BOOKING_ERROR_MESSAGES,
  parseBookingTime,
  parsePriceToCents,
  validateBookingWindow,
} from "@/lib/bookings";
import { validatePublicBookingDuration } from "@/lib/booking-calendar";
import {
  bookingStatusUrl,
  sendBookingDeclinedEmail,
} from "@/lib/booking-notifications";
import type { DbBookingStatus } from "@/lib/supabase/database.types";
import {
  isMissingSchemaError,
  type SupabaseErrorLike,
} from "@/lib/supabase/errors";

export type BookingActionResult = { error: string } | { ok: true };

export type BookingRequestResult =
  { error: string } | { ok: true; statusToken: string };

/** Exclusion constraint on bookings_no_overlap, or the RPC's raised code. */
const PG_EXCLUSION_VIOLATION = "23P01";

/**
 * Maps a write failure to a message the host can act on. Never surfaces the
 * raw Postgres text, but does distinguish the two causes worth fixing:
 * an unapplied migration and a double-booked court.
 */
function bookingWriteError(
  error: SupabaseErrorLike,
  context: string,
): { error: string } {
  if (isMissingSchemaError(error)) {
    console.error(`[bookings] ${context}: schema missing`, error);
    return { error: BOOKING_ERROR_MESSAGES.migrations };
  }
  if (error.code === PG_EXCLUSION_VIOLATION) {
    return { error: BOOKING_ERROR_MESSAGES.overlap };
  }
  console.error(`[bookings] ${context} failed`, error);
  return { error: BOOKING_ERROR_MESSAGES.save };
}

function revalidateBooking() {
  revalidatePath("/dashboard");
}

function readContact(formData: FormData) {
  const email = String(formData.get("contactEmail") ?? "").trim();
  const phone = String(formData.get("contactPhone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  return {
    contact_email: email || null,
    contact_phone: phone || null,
    notes: notes || null,
  };
}

/**
 * Staff-created booking. Lands as `confirmed` immediately, so it takes the
 * court out of open play as soon as its window opens.
 */
export async function createBookingAction(
  formData: FormData,
): Promise<BookingActionResult> {
  const venueId = String(formData.get("venueId") ?? "").trim();
  const courtId = String(formData.get("courtId") ?? "").trim();
  const bookedByName = String(formData.get("bookedByName") ?? "").trim();

  if (!venueId) return { error: BOOKING_ERROR_MESSAGES.venue };
  if (!courtId) return { error: BOOKING_ERROR_MESSAGES.court };
  if (!bookedByName) return { error: BOOKING_ERROR_MESSAGES.name };

  const startsAt = parseBookingTime(formData.get("startsAt"));
  const endsAt = parseBookingTime(formData.get("endsAt"));
  if (startsAt == null || endsAt == null) {
    return { error: BOOKING_ERROR_MESSAGES.time };
  }

  const windowError = validateBookingWindow(startsAt, endsAt);
  if (windowError) return { error: windowError };

  const priceCents = parsePriceToCents(formData.get("price"));
  if (priceCents === "invalid") return { error: BOOKING_ERROR_MESSAGES.price };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: BOOKING_ERROR_MESSAGES.signIn };

  const startsIso = new Date(startsAt).toISOString();
  const endsIso = new Date(endsAt).toISOString();

  const { data: coachingConflict } = await supabase
    .from("coaching_bookings")
    .select("id")
    .eq("court_id", courtId)
    .eq("status", "confirmed")
    .lt("starts_at", endsIso)
    .gt("ends_at", startsIso)
    .limit(1);

  if (coachingConflict && coachingConflict.length > 0) {
    return { error: BOOKING_ERROR_MESSAGES.overlap };
  }

  const { error } = await supabase.from("bookings").insert({
    venue_id: venueId,
    court_id: courtId,
    starts_at: startsIso,
    ends_at: endsIso,
    status: "confirmed",
    booked_by_name: bookedByName,
    // Already cents from parsePriceToCents; do not scale again.
    price_cents: priceCents,
    payment_status:
      String(formData.get("paymentStatus") ?? "") === "paid"
        ? "paid"
        : "unpaid",
    source: "staff",
    created_by: user.id,
    ...readContact(formData),
  });

  if (error) return bookingWriteError(error, "create");

  revalidateBooking();
  return { ok: true };
}

/**
 * Approve, decline, or cancel. The venue is read from the row rather than the
 * client so a tampered form cannot revalidate or target another venue.
 */
export async function setBookingStatusAction(
  bookingId: string,
  status: DbBookingStatus,
): Promise<BookingActionResult> {
  if (!bookingId) return { error: BOOKING_ERROR_MESSAGES.notFound };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: BOOKING_ERROR_MESSAGES.signIn };

  const { data: existing } = await supabase
    .from("bookings")
    .select("id, venue_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!existing) return { error: BOOKING_ERROR_MESSAGES.notFound };

  const { error } = await supabase
    .from("bookings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", bookingId);

  if (error) return bookingWriteError(error, "set status");

  revalidateBooking();
  return { ok: true };
}

const MAX_DECLINE_REASON_LENGTH = 500;

/**
 * Decline a pending public request with a reason the requester can see (and
 * receive by email when Resend is configured).
 */
export async function declineBookingRequestAction(
  bookingId: string,
  formData: FormData,
): Promise<BookingActionResult> {
  if (!bookingId) return { error: BOOKING_ERROR_MESSAGES.notFound };

  const declineReason = String(formData.get("declineReason") ?? "").trim();
  if (!declineReason) {
    return { error: BOOKING_ERROR_MESSAGES.declineReason };
  }
  if (declineReason.length > MAX_DECLINE_REASON_LENGTH) {
    return { error: BOOKING_ERROR_MESSAGES.declineReason };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: BOOKING_ERROR_MESSAGES.signIn };

  const { data: existing } = await supabase
    .from("bookings")
    .select(
      "id, status, venue_id, booked_by_name, contact_email, starts_at, ends_at, public_token",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (!existing) return { error: BOOKING_ERROR_MESSAGES.notFound };
  if (existing.status !== "pending") {
    return { error: BOOKING_ERROR_MESSAGES.save };
  }

  const { data: venue } = await supabase
    .from("venues")
    .select("name, slug, timezone")
    .eq("id", existing.venue_id)
    .maybeSingle();

  if (!venue) return { error: BOOKING_ERROR_MESSAGES.save };

  const { error } = await supabase
    .from("bookings")
    .update({
      status: "cancelled",
      decline_reason: declineReason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookingId);

  if (error) return bookingWriteError(error, "decline");

  const startsAt = new Date(existing.starts_at).getTime();
  const endsAt = new Date(existing.ends_at).getTime();
  const statusUrl = bookingStatusUrl(venue.slug, existing.public_token);

  if (existing.contact_email) {
    await sendBookingDeclinedEmail({
      to: existing.contact_email,
      venueName: venue.name,
      bookedByName: existing.booked_by_name,
      startsAt,
      endsAt,
      timeZone: venue.timezone,
      declineReason,
      statusUrl,
    });
  }

  revalidateBooking();
  return { ok: true };
}

export async function deleteBookingAction(
  bookingId: string,
): Promise<BookingActionResult> {
  if (!bookingId) return { error: BOOKING_ERROR_MESSAGES.notFound };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: BOOKING_ERROR_MESSAGES.signIn };

  const { data: existing } = await supabase
    .from("bookings")
    .select("id, venue_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!existing) return { error: BOOKING_ERROR_MESSAGES.notFound };

  const { error } = await supabase
    .from("bookings")
    .delete()
    .eq("id", bookingId);
  if (error) return bookingWriteError(error, "delete");

  revalidateBooking();
  return { ok: true };
}

/**
 * Public request from the unauthenticated booking page. Goes through the
 * SECURITY DEFINER RPC so anon never needs table access, and always lands as
 * `pending` for staff to approve.
 */
export async function requestBookingAction(
  formData: FormData,
): Promise<BookingRequestResult> {
  const venueId = String(formData.get("venueId") ?? "").trim();
  const courtId = String(formData.get("courtId") ?? "").trim();
  const bookedByName = String(formData.get("bookedByName") ?? "").trim();

  if (!venueId) return { error: BOOKING_ERROR_MESSAGES.venue };
  if (!courtId) return { error: BOOKING_ERROR_MESSAGES.court };
  if (!bookedByName) return { error: BOOKING_ERROR_MESSAGES.name };

  const startsAt = parseBookingTime(formData.get("startsAt"));
  const endsAt = parseBookingTime(formData.get("endsAt"));
  if (startsAt == null || endsAt == null) {
    return { error: BOOKING_ERROR_MESSAGES.time };
  }

  const windowError = validateBookingWindow(startsAt, endsAt);
  if (windowError) return { error: windowError };

  if (!validatePublicBookingDuration(startsAt, endsAt)) {
    return { error: BOOKING_ERROR_MESSAGES.duration };
  }

  const contact = readContact(formData);
  const supabase = await createClient();

  const { data: statusToken, error } = await supabase.rpc("request_booking", {
    p_venue_id: venueId,
    p_court_id: courtId,
    p_starts_at: new Date(startsAt).toISOString(),
    p_ends_at: new Date(endsAt).toISOString(),
    p_booked_by_name: bookedByName,
    p_contact_email: contact.contact_email,
    p_contact_phone: contact.contact_phone,
    p_notes: contact.notes,
  });

  if (error) return bookingWriteError(error, "public request");
  if (!statusToken) return { error: BOOKING_ERROR_MESSAGES.save };

  revalidateBooking();
  return { ok: true, statusToken };
}
