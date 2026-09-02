"use client";

import { useMemo, useState } from "react";
import {
  bookingsCoveringSlot,
  formatSlotRangeLabel,
  type HourlySlotGrid,
  type ScheduleBooking,
  zonedSlotToUtc,
  BOOKING_SLOT_DURATION_MS,
} from "@/lib/booking-calendar";
import { useHydrated } from "@/lib/use-hydrated";
import { formatVenueTimezoneLabel } from "@/lib/timezone";
import { cn } from "@/lib/utils";

function SlotColumnHeader({
  dayKey,
  hour,
  timeZone,
}: {
  dayKey: string;
  hour: number;
  timeZone: string;
}) {
  const hydrated = useHydrated();
  if (!hydrated) return <span>&nbsp;</span>;

  const range = formatSlotRangeLabel(dayKey, hour, timeZone);
  const [start, end] = range.split(" – ");
  if (!end) return <span className="whitespace-nowrap">{range}</span>;

  return (
    <span className="block leading-tight">
      <span className="block whitespace-nowrap font-medium text-[var(--foreground)]">
        {start}
      </span>
      <span className="block whitespace-nowrap text-[9px] text-[var(--muted)]">
        to {end}
      </span>
    </span>
  );
}

export function BookingScheduleCalendar({
  grid,
  courts,
  bookings,
  timeZone,
  selectedBookingId,
  onSelectBooking,
}: {
  grid: HourlySlotGrid;
  courts: Array<{ id: string; name: string }>;
  bookings: ScheduleBooking[];
  timeZone: string;
  selectedBookingId: string | null;
  onSelectBooking: (bookingId: string | null) => void;
}) {
  const hydrated = useHydrated();
  const [selectedDay, setSelectedDay] = useState(grid.days[0]?.key ?? "");

  const bookingsById = useMemo(
    () => new Map(bookings.map((booking) => [booking.id, booking])),
    [bookings],
  );

  return (
    <section className="space-y-2" aria-label="Booking schedule">
      <div>
        <h2 className="font-semibold">Schedule</h2>
        <p className="mt-0.5 text-sm text-[var(--muted)]">
          Tap a booking to review details. Times are in{" "}
          <span className="font-medium text-[var(--foreground)]">
            {hydrated
              ? formatVenueTimezoneLabel(timeZone)
              : "your venue timezone"}
          </span>
          .
        </p>
      </div>

      <div
        className="flex gap-1.5 overflow-x-auto pb-0.5"
        role="tablist"
        aria-label="Schedule days"
      >
        {grid.days.map((day) => {
          const active = day.key === selectedDay;
          return (
            <button
              key={day.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedDay(day.key)}
              className={cn(
                "shrink-0 rounded-md border px-2 py-1 text-left text-xs transition-colors",
                active
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]",
              )}
            >
              {hydrated ? (
                <>
                  <span className="uppercase tracking-wide">{day.weekday}</span>{" "}
                  <span className="font-medium">{day.dateLabel}</span>
                </>
              ) : (
                <span>&nbsp;</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
              <th
                scope="col"
                className="sticky left-0 z-10 w-16 border-r border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-1.5 text-left font-medium"
              >
                Court
              </th>
              {grid.hours.map((hour) => (
                <th
                  key={hour}
                  scope="col"
                  className="min-w-[4.25rem] px-1 py-1.5 text-center font-normal"
                >
                  <SlotColumnHeader
                    dayKey={selectedDay}
                    hour={hour}
                    timeZone={timeZone}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {courts.map((court) => (
              <tr
                key={court.id}
                className="border-b border-[var(--border)] last:border-b-0"
              >
                <th
                  scope="row"
                  className="sticky left-0 z-10 border-r border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-left text-xs font-medium whitespace-nowrap"
                >
                  {court.name}
                </th>
                {grid.hours.map((hour) => {
                  const slotStartsAt = zonedSlotToUtc(
                    selectedDay,
                    hour,
                    timeZone,
                  );
                  const slotEndsAt = slotStartsAt + BOOKING_SLOT_DURATION_MS;
                  const covering = bookingsCoveringSlot(
                    bookings,
                    court.id,
                    slotStartsAt,
                    slotEndsAt,
                  );
                  const booking = covering[0] ?? null;
                  const isSelected = booking?.id === selectedBookingId;

                  if (!booking) {
                    return (
                      <td key={hour} className="p-0.5 text-center">
                        <span className="text-[var(--muted)]">·</span>
                      </td>
                    );
                  }

                  const label =
                    covering.length > 1
                      ? `${covering.length} requests`
                      : (booking.bookedByName.split(" ")[0] ??
                        booking.bookedByName);

                  return (
                    <td key={hour} className="p-0.5 text-center">
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        aria-label={`${booking.bookedByName}, ${booking.status}`}
                        title={booking.bookedByName}
                        onClick={() => onSelectBooking(booking.id)}
                        className={cn(
                          "mx-auto flex h-7 w-full min-w-[3.5rem] max-w-[4.5rem] items-center justify-center rounded border px-0.5 text-[9px] font-medium transition-colors",
                          booking.status === "pending" &&
                            !isSelected &&
                            "border-amber-400 bg-amber-100 text-amber-950 hover:bg-amber-200",
                          booking.status === "pending" &&
                            isSelected &&
                            "border-amber-600 bg-amber-600 text-white",
                          booking.status === "confirmed" &&
                            !isSelected &&
                            "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20",
                          booking.status === "confirmed" &&
                            isSelected &&
                            "border-[var(--accent)] bg-[var(--accent)] text-white",
                        )}
                      >
                        <span className="truncate">{label}</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[var(--muted)]">
        <span className="font-medium text-amber-950">Amber</span> = pending
        request ·{" "}
        <span className="font-medium text-[var(--accent)]">Green</span> =
        confirmed booking
      </p>

      {selectedBookingId && bookingsById.has(selectedBookingId) ? null : (
        <p className="text-xs text-[var(--muted)]">
          Select a booking on the calendar to approve, decline, or cancel it.
        </p>
      )}
    </section>
  );
}
