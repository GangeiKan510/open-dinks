"use client";

import { formatTimeRange } from "@/lib/bookings";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * Renders a booking's time range in the venue timezone when provided, otherwise
 * the viewer's local zone. Withhold until hydration to avoid server/client skew.
 */
export function BookingWindow({
  startsAt,
  endsAt,
  timeZone,
  className,
}: {
  startsAt: number;
  endsAt: number;
  timeZone?: string;
  className?: string;
}) {
  const hydrated = useHydrated();

  return (
    <span className={className ?? ""}>
      {hydrated
        ? formatTimeRange(startsAt, endsAt, timeZone ? { timeZone } : undefined)
        : "\u00a0"}
    </span>
  );
}
