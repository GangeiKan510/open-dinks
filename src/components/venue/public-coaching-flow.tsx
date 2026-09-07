"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { requestCoachingBookingAction } from "@/app/actions/coaching";
import {
  BookingSlotPicker,
  type SelectedBookingRange,
} from "@/components/venue/booking-slot-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { HourlySlotGrid } from "@/lib/booking-calendar";
import { bookingStatusUrl } from "@/lib/booking-notifications";
import {
  formatDateAndTimeRange,
  formatPriceCents,
  type PublicBookingCourt,
} from "@/lib/bookings";
import { courtsAvailableForRange, type PublicCoach } from "@/lib/coaching";
import type { PublicBooker } from "@/lib/auth-redirect";
import { useHydrated } from "@/lib/use-hydrated";

export function PublicCoachingFlow({
  venueId,
  venueSlug,
  coaches,
  courts,
  courtBusy,
  grid,
  timeZone,
  dayCount,
  booker,
}: {
  venueId: string;
  venueSlug: string;
  coaches: PublicCoach[];
  courts: PublicBookingCourt[];
  courtBusy: Array<{ court_id: string; starts_at: string; ends_at: string }>;
  grid: HourlySlotGrid;
  timeZone: string;
  dayCount: number;
  booker: PublicBooker | null;
}) {
  const hydrated = useHydrated();
  const [selection, setSelection] = useState<SelectedBookingRange | null>(null);
  const [courtId, setCourtId] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [statusToken, setStatusToken] = useState<string | null>(null);

  const selectedCoach = useMemo(() => {
    if (!selection) return null;
    return coaches.find((coach) => coach.id === selection.courtId) ?? null;
  }, [coaches, selection]);

  const openCourts = useMemo(() => {
    if (!selection) return [];
    return courtsAvailableForRange(
      courts,
      courtBusy,
      selection.startsAt,
      selection.endsAt,
    );
  }, [courts, courtBusy, selection]);

  const selectionLabel = useMemo(() => {
    if (!selection || !hydrated) return null;
    const hours =
      selection.hours.length === 1
        ? "1 hour"
        : `${selection.hours.length} hours`;
    const rate =
      selectedCoach != null
        ? ` · est. ${formatPriceCents(selectedCoach.rateCents * selection.hours.length)}`
        : "";
    return `${selection.courtName} · ${formatDateAndTimeRange(
      selection.startsAt,
      selection.endsAt,
      { timeZone },
    )} (${hours})${rate}`;
  }, [hydrated, selection, selectedCoach, timeZone]);

  function onSubmit(formData: FormData) {
    if (!selection) {
      setError("Pick at least one open hour with a coach first.");
      return;
    }
    if (!courtId) {
      setError("Choose a free court for this coaching session.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await requestCoachingBookingAction(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setStatusToken(result.statusToken);
      setSelection(null);
      setCourtId("");
    });
  }

  const statusUrl = useMemo(() => {
    if (!statusToken) return null;
    return bookingStatusUrl(venueSlug, statusToken);
  }, [statusToken, venueSlug]);

  if (statusToken && statusUrl) {
    return (
      <div
        className="rounded-xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] p-5"
        role="status"
      >
        <h2 className="font-semibold">Coaching request sent</h2>
        <p className="mt-1 text-sm">
          The venue will confirm your coaching session shortly. Your coach and
          court are not reserved until they approve it. Save this link to check
          for updates.
        </p>
        <code className="mt-4 block break-all rounded-md bg-[var(--surface)] px-3 py-2 text-sm">
          {statusUrl}
        </code>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href={statusUrl}>Check request status</Link>
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setStatusToken(null);
              setError(null);
            }}
          >
            Request another time
          </Button>
        </div>
      </div>
    );
  }

  if (courts.length === 0) {
    return (
      <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
        This venue has not published any courts yet, so coaching cannot be
        booked.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <BookingSlotPicker
        grid={grid}
        courts={coaches.map((coach) => ({
          id: coach.id,
          name: `${coach.name} · ${formatPriceCents(coach.rateCents)}/hr`,
        }))}
        timeZone={timeZone}
        dayCount={dayCount}
        selection={selection}
        onSelect={(next) => {
          setSelection(next);
          setCourtId("");
        }}
        resourceLabel="Coach"
        title="Pick a coach & time"
        description={
          <>
            Rows are coaches. Open slots are inside their weekly availability.
            After you pick a time, choose a free court so the session does not
            clash with rentals.
          </>
        }
      />

      <form
        action={onSubmit}
        className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 md:grid-cols-2"
      >
        <input type="hidden" name="venueId" value={venueId} />
        <input type="hidden" name="timeZone" value={timeZone} />
        {selection ? (
          <>
            <input type="hidden" name="coachId" value={selection.courtId} />
            <input
              type="hidden"
              name="startsAt"
              value={new Date(selection.startsAt).toISOString()}
            />
            <input
              type="hidden"
              name="endsAt"
              value={new Date(selection.endsAt).toISOString()}
            />
          </>
        ) : null}

        <div className="space-y-1 md:col-span-2">
          <Label>Selected session</Label>
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm">
            {selectionLabel ?? (
              <span className="text-[var(--muted)]">
                Tap an open coach slot above.
              </span>
            )}
          </div>
        </div>

        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="public-coaching-court">Court</Label>
          <select
            id="public-coaching-court"
            name="courtId"
            required
            value={courtId}
            disabled={!selection || openCourts.length === 0}
            onChange={(event) => setCourtId(event.target.value)}
            className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 text-sm disabled:opacity-50"
          >
            <option value="">
              {!selection
                ? "Pick a coach time first"
                : openCourts.length === 0
                  ? "No courts free for this window"
                  : "Choose a free court"}
            </option>
            {openCourts.map((court) => (
              <option key={court.id} value={court.id}>
                {court.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="coach-request-name">Your name</Label>
          <Input
            id="coach-request-name"
            name="bookedByName"
            maxLength={120}
            required
            defaultValue={booker?.displayName ?? ""}
            placeholder="Name for the session"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="coach-request-phone">Phone</Label>
          <Input id="coach-request-phone" name="contactPhone" type="tel" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="coach-request-email">Email</Label>
          <Input
            id="coach-request-email"
            name="contactEmail"
            type="email"
            defaultValue={booker?.email ?? ""}
          />
        </div>

        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="coach-request-notes">Notes</Label>
          <Input
            id="coach-request-notes"
            name="notes"
            maxLength={1000}
            placeholder="Goals, skill level…"
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-red-700 md:col-span-2">
            {error}
          </p>
        ) : null}

        <div className="md:col-span-2">
          <Button
            type="submit"
            loading={pending}
            disabled={!selection || !courtId || !booker}
          >
            {booker ? "Request coaching" : "Sign in to request"}
          </Button>
        </div>
      </form>
    </div>
  );
}
