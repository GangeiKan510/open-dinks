"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  setCourtCountAction,
  updateFacilityBrandingAction,
  updateVenueBookingHoursAction,
  updateVenueTimezoneAction,
} from "@/app/actions/facility";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  bookingCloseHourOptions,
  bookingOpenHourOptions,
  formatBookingHourLabel,
  formatBookingHoursRange,
  is24HourBooking,
  type BookingHours,
} from "@/lib/booking-hours";
import { MAX_COURT_COUNT, MIN_COURT_COUNT } from "@/lib/court-count";
import { formatBrandTitle, type FacilityConfig } from "@/lib/facility";
import { formatSkillBand } from "@/lib/skill-tier";
import {
  COMMON_VENUE_TIMEZONES,
  formatVenueTimezoneLabel,
} from "@/lib/timezone";
import type { Database } from "@/lib/supabase/database.types";

type CourtRow = Database["public"]["Tables"]["courts"]["Row"];

export function FacilitySettings({
  facility,
  courts,
  venueTimezone,
  bookingHours,
}: {
  facility: FacilityConfig;
  courts: CourtRow[];
  venueTimezone: string;
  bookingHours: BookingHours;
}) {
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const [courtsError, setCourtsError] = useState<string | null>(null);
  const [timezoneError, setTimezoneError] = useState<string | null>(null);
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [open24Hours, setOpen24Hours] = useState(() =>
    is24HourBooking(bookingHours),
  );

  const activeBusyKey = pending ? busyKey : null;

  function onSaveBranding(formData: FormData) {
    setBusyKey("branding");
    setBrandingError(null);
    startTransition(async () => {
      const result = await updateFacilityBrandingAction(formData);
      if ("error" in result) {
        setBrandingError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Branding saved.");
    });
  }

  function onSaveCourts(formData: FormData) {
    setBusyKey("courts");
    setCourtsError(null);
    startTransition(async () => {
      const result = await setCourtCountAction(formData);
      if ("error" in result) {
        setCourtsError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Courts updated.");
    });
  }

  function onSaveTimezone(formData: FormData) {
    setBusyKey("timezone");
    setTimezoneError(null);
    startTransition(async () => {
      const result = await updateVenueTimezoneAction(formData);
      if ("error" in result) {
        setTimezoneError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Timezone saved.");
    });
  }

  function onSaveBookingHours(formData: FormData) {
    setBusyKey("hours");
    setHoursError(null);
    startTransition(async () => {
      const result = await updateVenueBookingHoursAction(formData);
      if ("error" in result) {
        setHoursError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Booking hours saved.");
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-1 font-semibold">Facility</h2>
          <p className="mb-4 text-sm text-[var(--muted)]">
            Shown on the wallboard and player view as{" "}
            <span className="font-medium text-[var(--foreground)]">
              {formatBrandTitle(facility)}
            </span>
            .
          </p>
          <form action={onSaveBranding} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="facilityName">Name</Label>
              <Input
                id="facilityName"
                name="name"
                defaultValue={facility.name}
                maxLength={120}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="facilityShortName">Short name</Label>
              <Input
                id="facilityShortName"
                name="shortName"
                defaultValue={facility.shortName}
                maxLength={32}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="facilityTagline">Tagline</Label>
              <Input
                id="facilityTagline"
                name="tagline"
                defaultValue={facility.tagline}
              />
            </div>
            {brandingError ? (
              <p role="alert" className="text-sm text-red-700">
                {brandingError}
              </p>
            ) : null}
            <Button
              type="submit"
              variant="secondary"
              loading={activeBusyKey === "branding"}
              disabled={pending}
            >
              Save facility
            </Button>
          </form>
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-1 font-semibold">Courts</h2>
          <p className="mb-4 text-sm text-[var(--muted)]">
            Set how many courts you run. Courts are added and removed from the
            end; a court that is booked or mid-game is never removed.
          </p>
          <form action={onSaveCourts} className="mb-4 flex items-end gap-2">
            <div className="w-28 space-y-1">
              <Label htmlFor="courtCount">Court count</Label>
              <Input
                id="courtCount"
                name="courtCount"
                type="number"
                min={MIN_COURT_COUNT}
                max={MAX_COURT_COUNT}
                defaultValue={courts.length || MIN_COURT_COUNT}
                required
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              loading={activeBusyKey === "courts"}
              disabled={pending}
            >
              Update
            </Button>
          </form>
          {courtsError ? (
            <p role="alert" className="mb-3 text-sm text-red-700">
              {courtsError}
            </p>
          ) : null}
          <ul className="space-y-2 text-sm">
            {courts.map((court) => (
              <li key={court.id} className="flex justify-between">
                <span>{court.name}</span>
                <span className="text-[var(--muted)]">
                  {court.skill_min != null
                    ? formatSkillBand(court.skill_min, court.skill_max)
                    : "Any skill"}
                </span>
              </li>
            ))}
            {courts.length === 0 ? (
              <li className="text-[var(--muted)]">No courts yet</li>
            ) : null}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="mb-1 font-semibold">Timezone</h2>
        <p className="mb-4 text-sm text-[var(--muted)]">
          Bookings and the public calendar use this timezone. Right now:{" "}
          <span className="font-medium text-[var(--foreground)]">
            {formatVenueTimezoneLabel(venueTimezone)}
          </span>
          .
        </p>
        <form
          action={onSaveTimezone}
          className="flex flex-wrap items-end gap-2"
        >
          <div className="min-w-[14rem] flex-1 space-y-1">
            <Label htmlFor="venueTimezone">IANA timezone</Label>
            <Input
              id="venueTimezone"
              name="timezone"
              list="venue-timezones"
              defaultValue={venueTimezone}
              required
            />
            <datalist id="venue-timezones">
              {COMMON_VENUE_TIMEZONES.map((zone) => (
                <option key={zone} value={zone} />
              ))}
            </datalist>
          </div>
          <Button
            type="submit"
            variant="secondary"
            loading={activeBusyKey === "timezone"}
            disabled={pending}
          >
            Save timezone
          </Button>
        </form>
        {timezoneError ? (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {timezoneError}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="mb-1 font-semibold">Booking hours</h2>
        <p className="mb-4 text-sm text-[var(--muted)]">
          Public and staff booking calendars only show slots inside this window.
          Right now:{" "}
          <span className="font-medium text-[var(--foreground)]">
            {formatBookingHoursRange(bookingHours, { timeZone: venueTimezone })}
          </span>
          .
        </p>
        <form action={onSaveBookingHours} className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="open24Hours"
              checked={open24Hours}
              onChange={(event) => setOpen24Hours(event.target.checked)}
              className="h-4 w-4 rounded border-[var(--border)]"
            />
            Open 24 hours for court bookings
          </label>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[10rem] space-y-1">
              <Label htmlFor="bookingOpenHour">Opens</Label>
              <select
                id="bookingOpenHour"
                name="bookingOpenHour"
                defaultValue={bookingHours.openHour}
                disabled={open24Hours}
                className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 text-sm disabled:opacity-50"
              >
                {bookingOpenHourOptions().map((hour) => (
                  <option key={hour} value={hour}>
                    {formatBookingHourLabel(hour, { timeZone: venueTimezone })}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[10rem] space-y-1">
              <Label htmlFor="bookingCloseHour">Closes</Label>
              <select
                id="bookingCloseHour"
                name="bookingCloseHour"
                defaultValue={bookingHours.closeHour}
                disabled={open24Hours}
                className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 text-sm disabled:opacity-50"
              >
                {bookingCloseHourOptions().map((hour) => (
                  <option key={hour} value={hour}>
                    {hour === 24
                      ? "Midnight (end of day)"
                      : formatBookingHourLabel(hour, {
                          timeZone: venueTimezone,
                        })}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="submit"
              variant="secondary"
              loading={activeBusyKey === "hours"}
              disabled={pending}
            >
              Save hours
            </Button>
          </div>
          {hoursError ? (
            <p role="alert" className="text-sm text-red-700">
              {hoursError}
            </p>
          ) : null}
        </form>
      </section>
    </div>
  );
}
