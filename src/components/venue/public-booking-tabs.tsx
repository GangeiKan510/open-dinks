"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { CalendarDays, GraduationCap } from "lucide-react";
import { BookerGoogleSignIn } from "@/components/venue/booker-google-sign-in";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { HourlySlotGrid } from "@/lib/booking-calendar";
import type { PublicBooker } from "@/lib/auth-redirect";
import type { PublicBookingCourt } from "@/lib/bookings";
import type { PublicCoach } from "@/lib/coaching";

const PublicBookingFlow = dynamic(() =>
  import("@/components/venue/public-booking-flow").then(
    (mod) => mod.PublicBookingFlow,
  ),
);

const PublicCoachingFlow = dynamic(() =>
  import("@/components/venue/public-coaching-flow").then(
    (mod) => mod.PublicCoachingFlow,
  ),
);

export function PublicBookingTabs({
  venueId,
  venueSlug,
  courts,
  courtGrid,
  courtBusy,
  coaches,
  coachingGrid,
  timeZone,
  dayCount,
  hoursLabel,
  timezoneLabel,
  booker,
}: {
  venueId: string;
  venueSlug: string;
  courts: PublicBookingCourt[];
  courtGrid: HourlySlotGrid;
  courtBusy: Array<{ court_id: string; starts_at: string; ends_at: string }>;
  coaches: PublicCoach[];
  coachingGrid: HourlySlotGrid;
  timeZone: string;
  dayCount: number;
  hoursLabel: string;
  timezoneLabel: string;
  booker: PublicBooker | null;
}) {
  const showCourts = courts.length > 0;
  const showCoaching = coaches.length > 0;
  const defaultTab = showCourts ? "courts" : "coaching";
  const [tab, setTab] = useState(defaultTab);
  const nextPath = `/book/${venueSlug}`;

  if (!showCourts && !showCoaching) {
    return (
      <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
        This venue has not published courts or coaches yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <BookerGoogleSignIn nextPath={nextPath} booker={booker} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Booking type">
          {showCourts ? (
            <TabsTrigger value="courts">
              <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
              Court rental
            </TabsTrigger>
          ) : null}
          {showCoaching ? (
            <TabsTrigger value="coaching">
              <GraduationCap className="h-4 w-4 shrink-0" aria-hidden />
              Coaching
            </TabsTrigger>
          ) : null}
        </TabsList>

        {showCourts ? (
          <TabsContent value="courts" className="space-y-4">
            <p className="text-sm text-[var(--muted)]">
              Tap open hours for consecutive 1-hour blocks on one court.
              Bookings are available {hoursLabel} in {timezoneLabel}. The venue
              confirms every request before the court is held for you.
            </p>
            {tab === "courts" ? (
              <PublicBookingFlow
                venueId={venueId}
                venueSlug={venueSlug}
                courts={courts}
                grid={courtGrid}
                timeZone={timeZone}
                dayCount={dayCount}
                booker={booker}
              />
            ) : null}
          </TabsContent>
        ) : null}

        {showCoaching ? (
          <TabsContent value="coaching" className="space-y-4">
            <p className="text-sm text-[var(--muted)]">
              Choose a coach and open hours inside their weekly availability,
              then pick a free court. Estimated price uses their hourly rate.
              The venue confirms every request before the session is held.
            </p>
            {tab === "coaching" ? (
              <PublicCoachingFlow
                venueId={venueId}
                venueSlug={venueSlug}
                coaches={coaches}
                courts={courts}
                courtBusy={courtBusy}
                grid={coachingGrid}
                timeZone={timeZone}
                dayCount={dayCount}
                booker={booker}
              />
            ) : null}
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
