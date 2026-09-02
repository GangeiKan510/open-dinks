import { notFound } from "next/navigation";
import { PublicBookingFlow } from "@/components/venue/public-booking-flow";
import {
  buildHourlySlotGrid,
  PUBLIC_BOOKING_LOOKAHEAD_DAYS,
} from "@/lib/booking-calendar";
import { parsePublicBookingVenue } from "@/lib/bookings";
import { formatBookingHoursRange } from "@/lib/booking-hours";
import { formatVenueTimezoneLabel } from "@/lib/timezone";
import { createClient } from "@/lib/supabase/server";

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  // SECURITY DEFINER RPCs: anon has no read access to bookings or courts, so
  // nothing here can leak who booked a court or their contact details.
  const { data: venueJson } = await supabase.rpc("get_public_booking_venue", {
    p_slug: slug,
  });
  const venue = parsePublicBookingVenue(venueJson);
  if (!venue) notFound();

  const from = new Date();
  const to = new Date(
    from.getTime() + PUBLIC_BOOKING_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000,
  );

  const { data: busy } = await supabase.rpc("get_court_busy_ranges", {
    p_venue_id: venue.id,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });

  const grid = buildHourlySlotGrid(venue.courts, busy ?? [], {
    fromMs: from.getTime(),
    dayCount: PUBLIC_BOOKING_LOOKAHEAD_DAYS,
    timeZone: venue.timezone,
    now: from.getTime(),
    openHour: venue.bookingOpenHour,
    closeHour: venue.bookingCloseHour,
  });

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
          Court booking
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl">
          {venue.name}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Tap open hours for consecutive 1-hour blocks on one court. Bookings
          are available {hoursLabel} in{" "}
          {formatVenueTimezoneLabel(venue.timezone)}. The venue confirms every
          request before the court is held for you.
        </p>
      </header>

      {venue.courts.length === 0 ? (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
          This venue has not published any courts yet.
        </p>
      ) : (
        <PublicBookingFlow
          venueId={venue.id}
          venueSlug={venue.slug}
          courts={venue.courts}
          grid={grid}
          timeZone={venue.timezone}
          dayCount={PUBLIC_BOOKING_LOOKAHEAD_DAYS}
        />
      )}
    </main>
  );
}
