"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { requestBookingAction } from "@/app/actions/bookings";
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
  type PublicBookingCourt,
} from "@/lib/bookings";
import { useHydrated } from "@/lib/use-hydrated";

export function PublicBookingFlow({
  venueId,
  venueSlug,
  courts,
  grid,
  timeZone,
  dayCount,
}: {
  venueId: string;
  venueSlug: string;
  courts: PublicBookingCourt[];
  grid: HourlySlotGrid;
  timeZone: string;
  dayCount: number;
}) {
  const hydrated = useHydrated();
  const [selection, setSelection] = useState<SelectedBookingRange | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [statusToken, setStatusToken] = useState<string | null>(null);

  const selectionLabel = useMemo(() => {
    if (!selection || !hydrated) return null;
    const hours =
      selection.hours.length === 1
        ? "1 hour"
        : `${selection.hours.length} hours`;
    return `${selection.courtName} · ${formatDateAndTimeRange(
      selection.startsAt,
      selection.endsAt,
      { timeZone },
    )} (${hours})`;
  }, [hydrated, selection, timeZone]);

  function onSubmit(formData: FormData) {
    if (!selection) {
      setError("Pick at least one open hour on the calendar first.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await requestBookingAction(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setStatusToken(result.statusToken);
      setSelection(null);
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
        <h2 className="font-semibold">Request sent</h2>
        <p className="mt-1 text-sm">
          The venue will confirm your court shortly. Your slot is not reserved
          until they approve it. Save this link to check for updates — we will
          email you too if you added an address.
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

  return (
    <div className="space-y-6">
      <BookingSlotPicker
        grid={grid}
        courts={courts}
        timeZone={timeZone}
        dayCount={dayCount}
        selection={selection}
        onSelect={setSelection}
      />

      <form
        action={onSubmit}
        className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 md:grid-cols-2"
      >
        <input type="hidden" name="venueId" value={venueId} />
        {selection ? (
          <>
            <input type="hidden" name="courtId" value={selection.courtId} />
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
          <Label>Selected time</Label>
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm">
            {selectionLabel ?? (
              <span className="text-[var(--muted)]">
                Tap open hours above — add more adjacent hours for a longer
                block.
              </span>
            )}
          </div>
        </div>

        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="request-name">Your name</Label>
          <Input
            id="request-name"
            name="bookedByName"
            maxLength={120}
            required
            placeholder="Name for the reservation"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="request-phone">Phone</Label>
          <Input id="request-phone" name="contactPhone" type="tel" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="request-email">Email</Label>
          <Input id="request-email" name="contactEmail" type="email" />
        </div>

        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="request-notes">Notes</Label>
          <Input
            id="request-notes"
            name="notes"
            maxLength={1000}
            placeholder="Anything the venue should know"
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-red-700 md:col-span-2">
            {error}
          </p>
        ) : null}

        <div className="md:col-span-2">
          <Button type="submit" loading={pending} disabled={!selection}>
            Request booking
          </Button>
        </div>
      </form>
    </div>
  );
}
