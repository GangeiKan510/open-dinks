import type { EngineCourt, EngineCourtBooking, EngineState } from "./types";

/**
 * The booking occupying this court at `now`, if any.
 * Start is inclusive and end is exclusive, so back-to-back bookings never
 * both match and a court frees up the instant its booking ends.
 */
export function activeCourtBooking(
  court: EngineCourt,
  now: number,
): EngineCourtBooking | null {
  const bookings = court.bookings ?? [];
  for (const booking of bookings) {
    if (booking.startsAt <= now && now < booking.endsAt) return booking;
  }
  return null;
}

export function isCourtBooked(court: EngineCourt, now: number): boolean {
  return activeCourtBooking(court, now) !== null;
}

/** Courts open play may use right now. */
export function bookableCourts(state: EngineState): EngineCourt[] {
  return state.courts.filter((court) => !isCourtBooked(court, state.now));
}

/** The next booking starting after `now`, ascending by start time. */
export function nextCourtBooking(
  court: EngineCourt,
  now: number,
): EngineCourtBooking | null {
  let soonest: EngineCourtBooking | null = null;
  for (const booking of court.bookings ?? []) {
    if (booking.startsAt <= now) continue;
    if (!soonest || booking.startsAt < soonest.startsAt) soonest = booking;
  }
  return soonest;
}
