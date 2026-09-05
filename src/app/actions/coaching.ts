"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  BOOKING_SLOT_DURATION_MS,
  validatePublicBookingDuration,
} from "@/lib/booking-calendar";
import { parseBookingTime, validateBookingWindow } from "@/lib/bookings";
import {
  COACHING_ERROR_MESSAGES,
  coachIsAvailableAtHour,
  coachingSessionPriceCents,
  parseAvailabilityFromForm,
  parseCoachName,
  parseCoachRateCents,
  parsePublicCoaches,
  weekdayIndexForDayKey,
  type CoachAvailabilityWindow,
} from "@/lib/coaching";
import {
  isMissingSchemaError,
  type SupabaseErrorLike,
} from "@/lib/supabase/errors";

export type CoachingActionResult = { error: string } | { ok: true };

const PG_EXCLUSION_VIOLATION = "23P01";

function coachingWriteError(
  error: SupabaseErrorLike,
  context: string,
): { error: string } {
  if (isMissingSchemaError(error)) {
    console.error(`[coaching] ${context}: schema missing`, error);
    return { error: COACHING_ERROR_MESSAGES.migrations };
  }
  if (error.code === PG_EXCLUSION_VIOLATION) {
    return { error: COACHING_ERROR_MESSAGES.overlap };
  }
  console.error(`[coaching] ${context} failed`, error);
  return { error: COACHING_ERROR_MESSAGES.save };
}

function revalidateCoaching() {
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

async function requireUser(): Promise<
  | { error: string }
  | {
      supabase: Awaited<ReturnType<typeof createClient>>;
      user: { id: string };
    }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: COACHING_ERROR_MESSAGES.signIn };
  return { supabase, user };
}

async function replaceCoachAvailability(
  supabase: Awaited<ReturnType<typeof createClient>>,
  coachId: string,
  windows: CoachAvailabilityWindow[],
) {
  const { error: deleteError } = await supabase
    .from("coach_availability")
    .delete()
    .eq("coach_id", coachId);
  if (deleteError) return deleteError;

  if (windows.length === 0) return null;

  const { error: insertError } = await supabase
    .from("coach_availability")
    .insert(
      windows.map((window) => ({
        coach_id: coachId,
        day_of_week: window.dayOfWeek,
        start_hour: window.startHour,
        end_hour: window.endHour,
      })),
    );
  return insertError;
}

export async function createCoachAction(
  formData: FormData,
): Promise<CoachingActionResult> {
  const auth = await requireUser();
  if ("error" in auth) return { error: auth.error };

  const venueId = String(formData.get("venueId") ?? "").trim();
  const name = parseCoachName(formData.get("name"));
  const rateCents = parseCoachRateCents(formData.get("rate"));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const windows = parseAvailabilityFromForm(formData);

  if (!venueId) return { error: COACHING_ERROR_MESSAGES.venue };
  if (!name) return { error: COACHING_ERROR_MESSAGES.name };
  if (rateCents === "invalid") return { error: COACHING_ERROR_MESSAGES.rate };
  if (windows === "invalid") {
    return { error: COACHING_ERROR_MESSAGES.availability };
  }

  const { data: coach, error } = await auth.supabase
    .from("coaches")
    .insert({
      venue_id: venueId,
      name,
      rate_cents: rateCents,
      notes,
      active: true,
    })
    .select("id")
    .single();

  if (error || !coach) {
    return coachingWriteError(
      error ?? { message: "insert failed" },
      "createCoach",
    );
  }

  const availabilityError = await replaceCoachAvailability(
    auth.supabase,
    coach.id,
    windows,
  );
  if (availabilityError) {
    await auth.supabase.from("coaches").delete().eq("id", coach.id);
    return coachingWriteError(availabilityError, "createCoachAvailability");
  }

  revalidateCoaching();
  return { ok: true };
}

export async function updateCoachAction(
  formData: FormData,
): Promise<CoachingActionResult> {
  const auth = await requireUser();
  if ("error" in auth) return { error: auth.error };

  const coachId = String(formData.get("coachId") ?? "").trim();
  const name = parseCoachName(formData.get("name"));
  const rateCents = parseCoachRateCents(formData.get("rate"));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const active =
    formData.get("active") === "on" || formData.get("active") === "true";
  const windows = parseAvailabilityFromForm(formData);

  if (!coachId) return { error: COACHING_ERROR_MESSAGES.coach };
  if (!name) return { error: COACHING_ERROR_MESSAGES.name };
  if (rateCents === "invalid") return { error: COACHING_ERROR_MESSAGES.rate };
  if (windows === "invalid") {
    return { error: COACHING_ERROR_MESSAGES.availability };
  }

  const { error } = await auth.supabase
    .from("coaches")
    .update({
      name,
      rate_cents: rateCents,
      notes,
      active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", coachId);

  if (error) return coachingWriteError(error, "updateCoach");

  const availabilityError = await replaceCoachAvailability(
    auth.supabase,
    coachId,
    windows,
  );
  if (availabilityError) {
    return coachingWriteError(availabilityError, "updateCoachAvailability");
  }

  revalidateCoaching();
  return { ok: true };
}

export async function setCoachActiveAction(
  formData: FormData,
): Promise<CoachingActionResult> {
  const auth = await requireUser();
  if ("error" in auth) return { error: auth.error };

  const coachId = String(formData.get("coachId") ?? "").trim();
  const active = formData.get("active") === "true";
  if (!coachId) return { error: COACHING_ERROR_MESSAGES.coach };

  const { error } = await auth.supabase
    .from("coaches")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", coachId);

  if (error) return coachingWriteError(error, "setCoachActive");
  revalidateCoaching();
  return { ok: true };
}

export async function createCoachingBookingAction(
  formData: FormData,
): Promise<CoachingActionResult> {
  const auth = await requireUser();
  if ("error" in auth) return { error: auth.error };

  const venueId = String(formData.get("venueId") ?? "").trim();
  const coachId = String(formData.get("coachId") ?? "").trim();
  const courtId = String(formData.get("courtId") ?? "").trim();
  const bookedByName = String(formData.get("bookedByName") ?? "").trim();
  const timeZone = String(formData.get("timeZone") ?? "UTC").trim() || "UTC";

  if (!venueId) return { error: COACHING_ERROR_MESSAGES.venue };
  if (!coachId) return { error: COACHING_ERROR_MESSAGES.coach };
  if (!courtId) return { error: COACHING_ERROR_MESSAGES.court };
  if (!bookedByName) return { error: COACHING_ERROR_MESSAGES.client };

  const startsAt = parseBookingTime(formData.get("startsAt"));
  const endsAt = parseBookingTime(formData.get("endsAt"));
  if (startsAt == null || endsAt == null) {
    return { error: COACHING_ERROR_MESSAGES.time };
  }

  const windowError = validateBookingWindow(startsAt, endsAt);
  if (windowError) return { error: windowError };

  if (!validatePublicBookingDuration(startsAt, endsAt)) {
    return { error: COACHING_ERROR_MESSAGES.duration };
  }

  const { data: coach, error: coachError } = await auth.supabase
    .from("coaches")
    .select("id, venue_id, rate_cents, active")
    .eq("id", coachId)
    .eq("venue_id", venueId)
    .maybeSingle();

  if (coachError) return coachingWriteError(coachError, "loadCoach");
  if (!coach || !coach.active)
    return { error: COACHING_ERROR_MESSAGES.notFound };

  const { data: availabilityRows, error: availabilityError } =
    await auth.supabase
      .from("coach_availability")
      .select("day_of_week, start_hour, end_hour")
      .eq("coach_id", coachId);

  if (availabilityError) {
    return coachingWriteError(availabilityError, "loadAvailability");
  }

  const availability: CoachAvailabilityWindow[] = (availabilityRows ?? []).map(
    (row) => ({
      dayOfWeek: row.day_of_week,
      startHour: row.start_hour,
      endHour: row.end_hour,
    }),
  );

  const hourCount = Math.round((endsAt - startsAt) / BOOKING_SLOT_DURATION_MS);
  for (let i = 0; i < hourCount; i++) {
    const slotStart = startsAt + i * BOOKING_SLOT_DURATION_MS;
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
    }).formatToParts(new Date(slotStart));
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    const hourRaw = Number(parts.find((p) => p.type === "hour")?.value);
    const hour = hourRaw === 24 ? 0 : hourRaw;
    if (!year || !month || !day) {
      return { error: COACHING_ERROR_MESSAGES.outside };
    }
    const dayKey = `${year}-${month}-${day}`;
    const dayOfWeek = weekdayIndexForDayKey(dayKey, timeZone);
    if (!coachIsAvailableAtHour(availability, dayOfWeek, hour)) {
      return { error: COACHING_ERROR_MESSAGES.outside };
    }
  }

  const { data: court, error: courtError } = await auth.supabase
    .from("courts")
    .select("id")
    .eq("id", courtId)
    .eq("venue_id", venueId)
    .maybeSingle();
  if (courtError) return coachingWriteError(courtError, "loadCourt");
  if (!court) return { error: COACHING_ERROR_MESSAGES.court };

  const startsIso = new Date(startsAt).toISOString();
  const endsIso = new Date(endsAt).toISOString();

  const [{ data: rentalBusy }, { data: coachingBusy }] = await Promise.all([
    auth.supabase
      .from("bookings")
      .select("id")
      .eq("court_id", courtId)
      .eq("status", "confirmed")
      .lt("starts_at", endsIso)
      .gt("ends_at", startsIso)
      .limit(1),
    auth.supabase
      .from("coaching_bookings")
      .select("id")
      .eq("court_id", courtId)
      .eq("status", "confirmed")
      .lt("starts_at", endsIso)
      .gt("ends_at", startsIso)
      .limit(1),
  ]);

  if (
    (rentalBusy && rentalBusy.length > 0) ||
    (coachingBusy && coachingBusy.length > 0)
  ) {
    return { error: COACHING_ERROR_MESSAGES.courtBusy };
  }

  const paymentStatus =
    String(formData.get("paymentStatus") ?? "unpaid") === "paid"
      ? "paid"
      : "unpaid";

  const { error } = await auth.supabase.from("coaching_bookings").insert({
    venue_id: venueId,
    coach_id: coachId,
    court_id: courtId,
    starts_at: startsIso,
    ends_at: endsIso,
    status: "confirmed",
    booked_by_name: bookedByName,
    ...readContact(formData),
    price_cents: coachingSessionPriceCents(coach.rate_cents, hourCount),
    payment_status: paymentStatus,
    source: "staff",
    created_by: auth.user.id,
  });

  if (error) return coachingWriteError(error, "createCoachingBooking");
  revalidateCoaching();
  return { ok: true };
}

export async function cancelCoachingBookingAction(
  formData: FormData,
): Promise<CoachingActionResult> {
  const auth = await requireUser();
  if ("error" in auth) return { error: auth.error };

  const bookingId = String(formData.get("bookingId") ?? "").trim();
  if (!bookingId) return { error: COACHING_ERROR_MESSAGES.notFound };

  const { error } = await auth.supabase
    .from("coaching_bookings")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookingId);

  if (error) return coachingWriteError(error, "cancelCoachingBooking");
  revalidateCoaching();
  return { ok: true };
}

export async function setCoachingBookingStatusAction(
  formData: FormData,
): Promise<CoachingActionResult> {
  const auth = await requireUser();
  if ("error" in auth) return { error: auth.error };

  const bookingId = String(formData.get("bookingId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!bookingId) return { error: COACHING_ERROR_MESSAGES.notFound };
  if (status !== "confirmed" && status !== "cancelled") {
    return { error: COACHING_ERROR_MESSAGES.save };
  }

  const { error } = await auth.supabase
    .from("coaching_bookings")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookingId);

  if (error) return coachingWriteError(error, "setCoachingBookingStatus");
  revalidateCoaching();
  return { ok: true };
}

/**
 * Public coaching request. Goes through SECURITY DEFINER RPC; always pending.
 */
export async function requestCoachingBookingAction(
  formData: FormData,
): Promise<{ error: string } | { ok: true; statusToken: string }> {
  const venueId = String(formData.get("venueId") ?? "").trim();
  const coachId = String(formData.get("coachId") ?? "").trim();
  const courtId = String(formData.get("courtId") ?? "").trim();
  const bookedByName = String(formData.get("bookedByName") ?? "").trim();
  const timeZone = String(formData.get("timeZone") ?? "UTC").trim() || "UTC";

  if (!venueId) return { error: COACHING_ERROR_MESSAGES.venue };
  if (!coachId) return { error: COACHING_ERROR_MESSAGES.coach };
  if (!courtId) return { error: COACHING_ERROR_MESSAGES.court };
  if (!bookedByName) return { error: COACHING_ERROR_MESSAGES.client };

  const startsAt = parseBookingTime(formData.get("startsAt"));
  const endsAt = parseBookingTime(formData.get("endsAt"));
  if (startsAt == null || endsAt == null) {
    return { error: COACHING_ERROR_MESSAGES.time };
  }

  const windowError = validateBookingWindow(startsAt, endsAt);
  if (windowError) return { error: windowError };

  if (!validatePublicBookingDuration(startsAt, endsAt)) {
    return { error: COACHING_ERROR_MESSAGES.duration };
  }

  const contact = readContact(formData);
  const supabase = await createClient();

  const { data: coachesJson } = await supabase.rpc("get_public_coaches", {
    p_venue_id: venueId,
  });
  const coaches = parsePublicCoaches(coachesJson);
  const coach = coaches.find((row) => row.id === coachId);
  if (!coach) return { error: COACHING_ERROR_MESSAGES.notFound };

  const hourCount = Math.round((endsAt - startsAt) / BOOKING_SLOT_DURATION_MS);
  for (let i = 0; i < hourCount; i++) {
    const slotStart = startsAt + i * BOOKING_SLOT_DURATION_MS;
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
    }).formatToParts(new Date(slotStart));
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    const hourRaw = Number(parts.find((p) => p.type === "hour")?.value);
    const hour = hourRaw === 24 ? 0 : hourRaw;
    if (!year || !month || !day) {
      return { error: COACHING_ERROR_MESSAGES.outside };
    }
    const dayKey = `${year}-${month}-${day}`;
    const dayOfWeek = weekdayIndexForDayKey(dayKey, timeZone);
    if (!coachIsAvailableAtHour(coach.availability, dayOfWeek, hour)) {
      return { error: COACHING_ERROR_MESSAGES.outside };
    }
  }

  const { data: statusToken, error } = await supabase.rpc(
    "request_coaching_booking",
    {
      p_venue_id: venueId,
      p_coach_id: coachId,
      p_court_id: courtId,
      p_starts_at: new Date(startsAt).toISOString(),
      p_ends_at: new Date(endsAt).toISOString(),
      p_booked_by_name: bookedByName,
      p_contact_email: contact.contact_email,
      p_contact_phone: contact.contact_phone,
      p_notes: contact.notes,
    },
  );

  if (error) return coachingWriteError(error, "public coaching request");
  if (!statusToken) return { error: COACHING_ERROR_MESSAGES.save };

  revalidateCoaching();
  return { ok: true, statusToken: String(statusToken) };
}
