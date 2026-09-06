import Link from "next/link";
import { redirect } from "next/navigation";
import { Radio } from "lucide-react";
import {
  addRosterPlayerAction,
  createSessionAction,
  signOutAction,
} from "@/app/actions/session";
import { BookingsManager } from "@/components/venue/bookings-manager";
import { DashboardTabs } from "@/components/venue/dashboard-tabs";
import { FacilitySettings } from "@/components/venue/facility-settings";
import { FacilitySetupForm } from "@/components/venue/facility-setup-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadAccountVenue } from "@/lib/account-venue";
import {
  buildHourlySlotGrid,
  busyRangesFromBookings,
  PUBLIC_BOOKING_LOOKAHEAD_DAYS,
} from "@/lib/booking-calendar";
import { venueBookingsFrom, venueBookingHistoryFrom } from "@/lib/bookings";
import { buildCoachHourlySlotGrid } from "@/lib/coaching";
import {
  DEFAULT_COURT_COUNT,
  MAX_COURT_COUNT,
  MIN_COURT_COUNT,
} from "@/lib/court-count";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { isSupabaseConfigured, siteUrl } from "@/lib/env";
import { facilityFromRow, formatBrandTitle } from "@/lib/facility";
import { ensureSingleLiveSession } from "@/lib/live-session";
import {
  DEFAULT_SKILL_TIER,
  formatSkillTier,
  SKILL_TIERS,
} from "@/lib/skill-tier";
import { createClient } from "@/lib/supabase/server";

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
        <Button asChild>
          <Link href="/demo">Open local demo</Link>
        </Button>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const venue = await loadAccountVenue(user.id);

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
    { data: players },
    { data: sessions },
    { data: facilityRow },
    { data: bookings },
    { data: bookingHistory },
    coachesResult,
    coachingBookingsResult,
    coachingHistoryResult,
    availabilityResult,
  ] = await Promise.all([
    supabase
      .from("courts")
      .select("*")
      .eq("venue_id", venue.id)
      .order("sort_order"),
    supabase.from("players").select("*").eq("venue_id", venue.id).order("name"),
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
    supabase.from("coach_availability").select("*"),
  ]);

  const facility = facilityRow ? facilityFromRow(facilityRow) : null;
  const courtRows = courts ?? [];
  const playerRows = players ?? [];
  const sessionRows = sessions ?? [];
  const bookingRows = bookings ?? [];
  const bookingHistoryRows = bookingHistory ?? [];

  const coachingSchemaReady =
    !isMissingSchemaError(coachesResult.error) &&
    !isMissingSchemaError(coachingBookingsResult.error) &&
    !isMissingSchemaError(coachingHistoryResult.error) &&
    !isMissingSchemaError(availabilityResult.error);

  const coachRows = coachingSchemaReady ? (coachesResult.data ?? []) : [];
  const coachingBookingRows = coachingSchemaReady
    ? (coachingBookingsResult.data ?? [])
    : [];
  const coachingHistoryRows = coachingSchemaReady
    ? (coachingHistoryResult.data ?? [])
    : [];
  const availabilityRows = coachingSchemaReady
    ? (availabilityResult.data ?? [])
    : [];

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
        <form action={signOutAction}>
          <Button variant="outline" type="submit">
            Sign out
          </Button>
        </form>
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

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Courts" value={String(courtRows.length)} />
        <Stat label="Pending requests" value={String(pendingRequests.length)} />
        <Stat
          label="Upcoming bookings"
          value={String(upcomingBookings.length)}
        />
        <Stat label="Saved players" value={String(playerRows.length)} />
      </dl>

      <DashboardTabs
        pendingRequestCount={pendingRequests.length}
        rosterCount={playerRows.length}
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
                <form
                  action={createSessionAction}
                  className="grid gap-3 md:grid-cols-3"
                >
                  <input type="hidden" name="venueId" value={venue.id} />
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      name="title"
                      defaultValue="Weeknight Open Play"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="courtCount">Courts in play</Label>
                    <Input
                      id="courtCount"
                      name="courtCount"
                      type="number"
                      min={MIN_COURT_COUNT}
                      max={MAX_COURT_COUNT}
                      defaultValue={Math.max(
                        MIN_COURT_COUNT,
                        courtRows.length || DEFAULT_COURT_COUNT,
                      )}
                      required
                    />
                    <p className="text-xs text-[var(--muted)]">
                      {courtRows.length} court
                      {courtRows.length === 1 ? "" : "s"} at this facility
                    </p>
                  </div>
                  <div className="md:col-span-3">
                    <Button type="submit">Go live</Button>
                  </div>
                </form>
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
        bookings={
          <BookingsManager
            venueId={venue.id}
            courts={courtRows}
            bookings={bookingRows}
            bookingHistory={bookingHistoryRows}
            grid={bookingGrid}
            timeZone={venue.timezone}
            publicBookingUrl={`${siteUrl()}${bookingPath}`}
            bookingPath={bookingPath}
            coaches={coachesWithAvailability}
            coachingBookings={coachingBookingRows}
            coachingHistory={coachingHistoryRows}
            coachingGrid={coachingGrid}
          />
        }
        roster={
          <section className={CARD}>
            <h2 className="mb-1 font-semibold">Roster</h2>
            <p className="mb-4 text-sm text-[var(--muted)]">
              Saved players can be checked into any session without retyping
              their name and skill.
            </p>
            <form action={addRosterPlayerAction} className="mb-4 flex gap-2">
              <input type="hidden" name="venueId" value={venue.id} />
              <Input name="name" placeholder="Player name" required />
              <select
                name="skill"
                aria-label="Skill"
                defaultValue={DEFAULT_SKILL_TIER}
                className="h-10 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 text-sm"
              >
                {SKILL_TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {formatSkillTier(tier)}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="secondary">
                Add
              </Button>
            </form>
            <ul className="max-h-96 space-y-2 overflow-auto text-sm">
              {playerRows.map((p) => (
                <li
                  key={p.id}
                  className="flex justify-between border-b border-[var(--border)] pb-2 last:border-0"
                >
                  <span>{p.name}</span>
                  <span className="text-[var(--muted)]">
                    {formatSkillTier(p.skill)}
                  </span>
                </li>
              ))}
              {playerRows.length === 0 ? (
                <li className="text-[var(--muted)]">No saved players yet</li>
              ) : null}
            </ul>
          </section>
        }
        settings={
          facility ? (
            <FacilitySettings
              facility={facility}
              courts={courtRows}
              venueTimezone={venue.timezone}
              bookingHours={{
                openHour: venue.bookingOpenHour,
                closeHour: venue.bookingCloseHour,
              }}
            />
          ) : (
            <section className={CARD}>
              <p className="text-sm text-[var(--muted)]">
                Facility settings are unavailable right now.
              </p>
            </section>
          )
        }
      />
    </main>
  );
}
