import { notFound } from "next/navigation";
import { PublicBookingTabs } from "@/components/venue/public-booking-tabs";
import {
  buildHourlySlotGrid,
  PUBLIC_BOOKING_LOOKAHEAD_DAYS,
} from "@/lib/booking-calendar";
import { publicBookerFromUser } from "@/lib/auth-redirect";
import { parsePublicBookingVenue } from "@/lib/bookings";
import { formatBookingHoursRange } from "@/lib/booking-hours";
import { buildCoachHourlySlotGrid, parsePublicCoaches } from "@/lib/coaching";
import { formatVenueTimezoneLabel } from "@/lib/timezone";
import { createClient } from "@/lib/supabase/server";

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const booker = user ? publicBookerFromUser(user) : null;

  // SECURITY DEFINER RPCs: anon has no table grants for bookings/coaches.
  const { data: venueJson } = await supabase.rpc("get_public_booking_venue", {
    p_slug: slug,
  });
  const venue = parsePublicBookingVenue(venueJson);
  if (!venue) notFound();

  const from = new Date();
  const to = new Date(
    from.getTime() + PUBLIC_BOOKING_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000,
  );

  const [{ data: busy }, coachesRpc, coachBusyRpc] = await Promise.all([
    supabase.rpc("get_court_busy_ranges", {
      p_venue_id: venue.id,
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    }),
    supabase.rpc("get_public_coaches", { p_venue_id: venue.id }),
    supabase.rpc("get_coach_busy_ranges", {
      p_venue_id: venue.id,
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    }),
  ]);

  const coaches = coachesRpc.error ? [] : parsePublicCoaches(coachesRpc.data);
  const coachBusy = coachBusyRpc.error ? [] : (coachBusyRpc.data ?? []);

  const courtGrid = buildHourlySlotGrid(venue.courts, busy ?? [], {
    fromMs: from.getTime(),
    dayCount: PUBLIC_BOOKING_LOOKAHEAD_DAYS,
    timeZone: venue.timezone,
    now: from.getTime(),
    openHour: venue.bookingOpenHour,
    closeHour: venue.bookingCloseHour,
  });

  const coachingGrid = buildCoachHourlySlotGrid(
    coaches,
    coachBusy.map((row) => ({
      coach_id: row.coach_id,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      status: "confirmed",
    })),
    {
      fromMs: from.getTime(),
      dayCount: PUBLIC_BOOKING_LOOKAHEAD_DAYS,
      timeZone: venue.timezone,
      now: from.getTime(),
      openHour: venue.bookingOpenHour,
      closeHour: venue.bookingCloseHour,
    },
  );

  const hoursLabel = formatBookingHoursRange(
    {
      openHour: venue.bookingOpenHour,
      closeHour: venue.bookingCloseHour,
    },
    { timeZone: venue.timezone },
  );

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          Book with us
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl">
          {venue.name}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Reserve a court or request a coaching session. Everything is in{" "}
          {formatVenueTimezoneLabel(venue.timezone)}. Sign in with Google before
          sending a request.
        </p>
      </header>

      <PublicBookingTabs
        venueId={venue.id}
        venueSlug={venue.slug}
        courts={venue.courts}
        courtGrid={courtGrid}
        courtBusy={busy ?? []}
        coaches={coaches}
        coachingGrid={coachingGrid}
        timeZone={venue.timezone}
        dayCount={PUBLIC_BOOKING_LOOKAHEAD_DAYS}
        hoursLabel={hoursLabel}
        timezoneLabel={formatVenueTimezoneLabel(venue.timezone)}
        booker={booker}
      />
    </main>
  );
}
