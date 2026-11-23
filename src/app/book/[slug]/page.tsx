import type { Metadata } from "next";
import { cache } from "react";
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
import { PRODUCT_NAME } from "@/lib/facility";
import { PRIVATE_ROBOTS } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { loadPlanCatalog } from "@/lib/platform-catalog-server";

const loadPublicBookingVenue = cache(async (slug: string) => {
  const supabase = await createClient();
  // SECURITY DEFINER RPC: anon has no table grants for venues.
  const { data: venueJson } = await supabase.rpc("get_public_booking_venue", {
    p_slug: slug,
  });
  return { supabase, venue: parsePublicBookingVenue(venueJson) };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { venue } = await loadPublicBookingVenue(slug);
  const name = venue?.name.trim();
  if (!venue || !name) {
    return { title: "Book a court", robots: PRIVATE_ROBOTS };
  }
  return {
    title: name,
    description: `Book a court or a coaching session at ${name} on ${PRODUCT_NAME}.`,
    alternates: { canonical: `/book/${venue.slug}` },
  };
}

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!(await loadPlanCatalog()).booking) {
    return (
      <main className="mx-auto max-w-lg space-y-4 px-6 py-16">
        <h1 className="font-[family-name:var(--font-display)] text-4xl">
          Court booking is not open yet
        </h1>
        <p className="text-[var(--muted)]">
          This club is not taking court or coaching requests right now.
        </p>
      </main>
    );
  }
  const { supabase, venue } = await loadPublicBookingVenue(slug);
  if (!venue) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const booker = user ? publicBookerFromUser(user) : null;

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

      {venue.acceptingBookings ? (
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
      ) : (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-sm text-[var(--muted)]">
          This club isn&apos;t taking court or coaching requests right now.
        </p>
      )}
    </main>
  );
}
