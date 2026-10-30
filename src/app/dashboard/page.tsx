import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Radio } from "lucide-react";
import { DashboardTabs } from "@/components/venue/dashboard-tabs";
import { OpenPlaySetupForm } from "@/components/venue/open-play-setup-form";
import { SignOutButton } from "@/components/venue/sign-out-button";
import { FacilitySetupForm } from "@/components/venue/facility-setup-form";
import { Button } from "@/components/ui/button";
import { loadAccountVenue } from "@/lib/account-venue";
import {
  buildHourlySlotGrid,
  busyRangesFromBookings,
  PUBLIC_BOOKING_LOOKAHEAD_DAYS,
} from "@/lib/booking-calendar";
import { venueBookingsFrom, venueBookingHistoryFrom } from "@/lib/bookings";
import { buildCoachHourlySlotGrid } from "@/lib/coaching";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { isSupabaseConfigured, siteUrl } from "@/lib/env";
import { facilityFromRow, formatBrandTitle } from "@/lib/facility";
import { ensureSingleLiveSession } from "@/lib/live-session";
import { defaultOpenPlayTitle } from "@/lib/open-play";
import { createClient } from "@/lib/supabase/server";
import { resolveTheme, THEME_COOKIE } from "@/lib/theme";

const CARD = "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${CARD} py-4`}>
      <dt className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto max-w-lg space-y-4 px-6 py-16">
        <h1 className="text-3xl font-semibold">Connect Supabase</h1>
        <p className="text-[var(--muted)]">
          Copy <code>.env.example</code> to <code>.env.local</code>, add your
          project URL and anon key, then run the migration in{" "}
          <code>supabase/migrations</code>.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/demo">Open local demo</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/tournament">Tournament mode</Link>
          </Button>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const venue = await loadAccountVenue(user.id, supabase);

  if (!venue) {
    return (
      <main className="mx-auto max-w-2xl space-y-6 px-6 py-16">
        <header>
          <h1 className="font-[family-name:var(--font-display)] text-4xl">
            Set up your facility
          </h1>
          <p className="mt-2 text-[var(--muted)]">
            Name the place you run open play at and how many courts you have.
            You can change both later.
          </p>
        </header>
        <section className={CARD}>
          <FacilitySetupForm />
        </section>
      </main>
    );
  }

  const bookingsFrom = venueBookingsFrom();
  const bookingHistoryFrom = venueBookingHistoryFrom();

  const liveSession = await ensureSingleLiveSession(supabase, venue.id);

  const [
    { data: courts },
    { data: sessions },
    { data: facilityRow },
    { data: bookings },
    { data: bookingHistory },
    coachesResult,
    coachingBookingsResult,
    coachingHistoryResult,
    profileResult,
  ] = await Promise.all([
    supabase
      .from("courts")
      .select("*")
      .eq("venue_id", venue.id)
      .order("sort_order"),
    supabase
      .from("sessions")
      .select("*")
      .eq("venue_id", venue.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("facilities")
      .select("id, slug, name, short_name, tagline")
      .eq("id", venue.facilityId)
      .single(),
    supabase
      .from("bookings")
      .select("*")
      .eq("venue_id", venue.id)
      .neq("status", "cancelled")
      .gt("ends_at", bookingsFrom)
      .order("starts_at"),
    supabase
      .from("bookings")
      .select("*")
      .eq("venue_id", venue.id)
      .gte("starts_at", bookingHistoryFrom)
      .or(`status.eq.cancelled,ends_at.lte."${bookingsFrom}"`)
      .order("starts_at", { ascending: false })
      .limit(100),
    supabase.from("coaches").select("*").eq("venue_id", venue.id).order("name"),
    supabase
      .from("coaching_bookings")
      .select("*")
      .eq("venue_id", venue.id)
      .neq("status", "cancelled")
      .gt("ends_at", bookingsFrom)
      .order("starts_at"),
    supabase
      .from("coaching_bookings")
      .select("*")
      .eq("venue_id", venue.id)
      .gte("starts_at", bookingHistoryFrom)
      .or(`status.eq.cancelled,ends_at.lte."${bookingsFrom}"`)
      .order("starts_at", { ascending: false })
      .limit(100),
    supabase.from("profiles").select("theme").eq("id", user.id).maybeSingle(),
  ]);

  const facility = facilityRow ? facilityFromRow(facilityRow) : null;
  const courtRows = courts ?? [];
  const sessionRows = sessions ?? [];
  const bookingRows = bookings ?? [];
  const bookingHistoryRows = bookingHistory ?? [];

  const coachingSchemaReady =
    !isMissingSchemaError(coachesResult.error) &&
    !isMissingSchemaError(coachingBookingsResult.error) &&
    !isMissingSchemaError(coachingHistoryResult.error);

  const coachRows = coachingSchemaReady ? (coachesResult.data ?? []) : [];
  const coachingBookingRows = coachingSchemaReady
    ? (coachingBookingsResult.data ?? [])
    : [];
  const coachingHistoryRows = coachingSchemaReady
    ? (coachingHistoryResult.data ?? [])
    : [];
  const coachIds = coachRows.map((coach) => coach.id);
  const availabilityResult =
    coachingSchemaReady && coachIds.length > 0
      ? await supabase
          .from("coach_availability")
          .select("*")
          .in("coach_id", coachIds)
      : { data: [], error: null };
  const availabilityRows = isMissingSchemaError(availabilityResult.error)
    ? []
    : (availabilityResult.data ?? []);

  const availabilityByCoach = new Map<
    string,
    Array<{ dayOfWeek: number; startHour: number; endHour: number }>
  >();
  for (const row of availabilityRows) {
    const list = availabilityByCoach.get(row.coach_id) ?? [];
    list.push({
      dayOfWeek: row.day_of_week,
      startHour: row.start_hour,
      endHour: row.end_hour,
    });
    availabilityByCoach.set(row.coach_id, list);
  }

  const coachesWithAvailability = coachRows.map((coach) => ({
    id: coach.id,
    name: coach.name,
    rateCents: coach.rate_cents,
    active: coach.active,
    notes: coach.notes,
    availability: availabilityByCoach.get(coach.id) ?? [],
  }));

  const pendingRequests = bookingRows.filter((b) => b.status === "pending");
  const upcomingBookings = bookingRows.filter((b) => b.status === "confirmed");
  const bookingPath = `/book/${venue.slug}`;

  const bookingGridFrom = new Date();
  const bookingGrid = buildHourlySlotGrid(
    courtRows.map((court) => ({ id: court.id, name: court.name })),
    busyRangesFromBookings(
      [
        ...bookingRows,
        ...coachingBookingRows.map((booking) => ({
          court_id: booking.court_id,
          starts_at: booking.starts_at,
          ends_at: booking.ends_at,
          status: booking.status,
        })),
      ],
      { includePending: true },
    ),
    {
      fromMs: bookingGridFrom.getTime(),
      dayCount: PUBLIC_BOOKING_LOOKAHEAD_DAYS,
      timeZone: venue.timezone,
      now: bookingGridFrom.getTime(),
      openHour: venue.bookingOpenHour,
      closeHour: venue.bookingCloseHour,
    },
  );

  const coachingGrid = buildCoachHourlySlotGrid(
    coachesWithAvailability.filter((coach) => coach.active),
    coachingBookingRows.map((booking) => ({
      coach_id: booking.coach_id,
      starts_at: booking.starts_at,
      ends_at: booking.ends_at,
      status: booking.status,
    })),
    {
      fromMs: bookingGridFrom.getTime(),
      dayCount: PUBLIC_BOOKING_LOOKAHEAD_DAYS,
      timeZone: venue.timezone,
      now: bookingGridFrom.getTime(),
      openHour: venue.bookingOpenHour,
      closeHour: venue.bookingCloseHour,
    },
  );

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            {formatBrandTitle(facility)}
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl">
            {facility?.name ?? venue.name}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/tournament">Tournament</Link>
          </Button>
          <SignOutButton />
        </div>
      </header>

      {liveSession ? (
        <Link
          href={`/s/${liveSession.public_token}/host`}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-3"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Radio className="h-4 w-4 shrink-0 animate-pulse" aria-hidden />
            Live now · {liveSession.title}
          </span>
          <span className="text-sm text-[var(--accent)] underline">
            Open host console
          </span>
        </Link>
      ) : null}

      <dl className="grid gap-3 sm:grid-cols-3">
        <Stat label="Courts" value={String(courtRows.length)} />
        <Stat label="Pending requests" value={String(pendingRequests.length)} />
        <Stat
          label="Upcoming bookings"
          value={String(upcomingBookings.length)}
        />
      </dl>

      <DashboardTabs
        pendingRequestCount={pendingRequests.length}
        openPlay={
          <>
            {liveSession ? (
              <section className={CARD}>
                <h2 className="mb-1 font-semibold">Session in progress</h2>
                <p className="mb-4 text-sm text-[var(--muted)]">
                  You can run one session at a time. End{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {liveSession.title}
                  </span>{" "}
                  from the host console before starting another.
                </p>
                <Button asChild>
                  <Link href={`/s/${liveSession.public_token}/host`}>
                    Open host console
                  </Link>
                </Button>
              </section>
            ) : (
              <section className={CARD}>
                <h2 className="mb-1 font-semibold">Start open play</h2>
                <p className="mb-4 text-sm text-[var(--muted)]">
                  Going live opens a wallboard and a player check-in link for
                  this session.
                </p>
                <OpenPlaySetupForm
                  venueId={venue.id}
                  defaultTitle={defaultOpenPlayTitle(venue.timezone)}
                />
              </section>
            )}

            <section className="space-y-3">
              <h2 className="font-semibold">Past sessions</h2>
              {sessionRows.map((s) => (
                <Link
                  key={s.id}
                  href={`/s/${s.public_token}/host`}
                  className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm transition-colors hover:border-[var(--accent)]"
                >
                  <span>{s.title}</span>
                  <span className="text-[var(--muted)]">Completed</span>
                </Link>
              ))}
              {sessionRows.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  No past sessions yet.
                </p>
              ) : null}
            </section>
          </>
        }
        bookings={{
          venueId: venue.id,
          courts: courtRows,
          bookings: bookingRows,
          bookingHistory: bookingHistoryRows,
          grid: bookingGrid,
          timeZone: venue.timezone,
          publicBookingUrl: `${siteUrl()}${bookingPath}`,
          bookingPath,
          coaches: coachesWithAvailability,
          coachingBookings: coachingBookingRows,
          coachingHistory: coachingHistoryRows,
          coachingGrid,
        }}
        settings={
          facility
            ? {
                facility,
                courts: courtRows,
                venueTimezone: venue.timezone,
                bookingHours: {
                  openHour: venue.bookingOpenHour,
                  closeHour: venue.bookingCloseHour,
                },
                theme: resolveTheme(
                  (await cookies()).get(THEME_COOKIE)?.value,
                  profileResult.data?.theme,
                ),
              }
            : null
        }
        settingsFallback={
          <section className={CARD}>
            <p className="text-sm text-[var(--muted)]">
              Facility settings are unavailable right now.
            </p>
          </section>
        }
      />
    </main>
  );
}
