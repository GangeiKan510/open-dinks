"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  formatSlotRangeLabel,
  slotsForDay,
  toggleConsecutiveSelection,
  type HourlyBookableSlot,
  type HourlySlotGrid,
  type SelectedBookingRange,
} from "@/lib/booking-calendar";
import { useHydrated } from "@/lib/use-hydrated";
import { formatVenueTimezoneLabel } from "@/lib/timezone";
import { cn } from "@/lib/utils";

export type { SelectedBookingRange };

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

export function BookingSlotPicker({
  grid,
  courts,
  timeZone,
  selection,
  onSelect,
  resourceLabel = "Court",
  title = "Pick your time",
  description,
}: {
  grid: HourlySlotGrid;
  courts: Array<{ id: string; name: string }>;
  timeZone: string;
  dayCount?: number;
  selection: SelectedBookingRange | null;
  onSelect: (selection: SelectedBookingRange | null) => void;
  resourceLabel?: string;
  title?: string;
  description?: ReactNode;
}) {
  const hydrated = useHydrated();
  const [selectedDay, setSelectedDay] = useState(grid.days[0]?.key ?? "");

  const daySlots = useMemo(
    () => slotsForDay(grid, selectedDay),
    [grid, selectedDay],
  );

  const slotByCourtHour = useMemo(() => {
    const map = new Map<string, HourlyBookableSlot>();
    for (const slot of daySlots) {
      map.set(`${slot.courtId}:${slot.hour}`, slot);
    }
    return map;
  }, [daySlots]);

  const selectedHours = useMemo(() => {
    if (!selection || selection.dayKey !== selectedDay)
      return new Set<number>();
    return new Set(selection.hours);
  }, [selection, selectedDay]);

  function slotLabel(hour: number): string {
    return formatSlotRangeLabel(selectedDay, hour, timeZone);
  }

  return (
    <section className="space-y-2" aria-label={`${resourceLabel} availability`}>
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-0.5 text-sm text-[var(--muted)]">
          {description ?? (
            <>
              Each column is a 1-hour rental in{" "}
              <span className="font-medium text-[var(--foreground)]">
                {hydrated
                  ? formatVenueTimezoneLabel(timeZone)
                  : "your venue timezone"}
              </span>
              . Tap open slots on the same court to book back-to-back hours. For
              a gap later in the day, submit a separate request.
            </>
          )}
        </p>
      </div>

      <div
        className="flex gap-1.5 overflow-x-auto pb-0.5"
        role="tablist"
        aria-label="Booking days"
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
                {resourceLabel}
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
                  const slot = slotByCourtHour.get(`${court.id}:${hour}`);
                  if (!slot) {
                    return (
                      <td key={hour} className="p-0.5 text-center">
                        <span className="text-[var(--muted)]">·</span>
                      </td>
                    );
                  }

                  const isSelected =
                    selection?.courtId === slot.courtId &&
                    selection.dayKey === slot.dayKey &&
                    selectedHours.has(slot.hour);
                  const isAvailable = slot.status === "available";
                  const range = hydrated ? slotLabel(hour) : "1 hour";

                  return (
                    <td key={hour} className="p-0.5 text-center">
                      <button
                        type="button"
                        disabled={!isAvailable}
                        aria-pressed={isSelected}
                        aria-label={`${court.name}, ${range}, ${
                          isAvailable ? "available" : slot.status
                        }`}
                        title={range}
                        onClick={() =>
                          onSelect(
                            toggleConsecutiveSelection(
                              selection,
                              slot,
                              slotByCourtHour,
                            ),
                          )
                        }
                        className={cn(
                          "mx-auto flex h-7 w-full min-w-[3.5rem] max-w-[4.5rem] items-center justify-center rounded border px-0.5 text-[9px] font-medium transition-colors",
                          isAvailable &&
                            !isSelected &&
                            "border-[var(--accent)]/30 bg-[var(--accent)]/5 text-[var(--accent)] hover:bg-[var(--accent)]/15",
                          isAvailable &&
                            isSelected &&
                            "border-[var(--accent)] bg-[var(--accent)] text-white",
                          slot.status === "booked" &&
                            "cursor-not-allowed border-amber-300 bg-amber-100 text-amber-900",
                          slot.status === "past" &&
                            "cursor-not-allowed border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]",
                        )}
                      >
                        {slot.status === "available"
                          ? isSelected
                            ? "✓"
                            : "Open"
                          : slot.status === "booked"
                            ? "Taken"
                            : "Past"}
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
        <span className="font-medium text-[var(--foreground)]">Open</span> =
        available · <span className="font-medium text-amber-900">Taken</span> =
        already booked · scroll sideways for later hours
      </p>

      {selection && selection.dayKey === selectedDay ? (
        <p className="text-xs text-[var(--muted)]">
          {selection.hours.length} hour{selection.hours.length === 1 ? "" : "s"}{" "}
          selected on {selection.courtName}. Tap the edge hour to shorten, or a
          non-adjacent hour to start a new block.
        </p>
      ) : null}
    </section>
  );
}
