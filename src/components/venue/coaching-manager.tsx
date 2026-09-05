"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  cancelCoachingBookingAction,
  createCoachAction,
  createCoachingBookingAction,
  setCoachActiveAction,
  setCoachingBookingStatusAction,
  updateCoachAction,
  type CoachingActionResult,
} from "@/app/actions/coaching";
import {
  BookingSlotPicker,
  type SelectedBookingRange,
} from "@/components/venue/booking-slot-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { HourlySlotGrid } from "@/lib/booking-calendar";
import {
  bookingCloseHourOptions,
  bookingOpenHourOptions,
  formatBookingHourLabel,
} from "@/lib/booking-hours";
import { formatDateAndTimeRange, formatPriceCents } from "@/lib/bookings";
import {
  WEEKDAY_LABELS,
  courtsAvailableForRange,
  groupAvailabilityByHours,
  type CoachAvailabilityWindow,
  type CoachWithAvailability,
} from "@/lib/coaching";
import { useHydrated } from "@/lib/use-hydrated";
import type { Database } from "@/lib/supabase/database.types";

type CoachingBookingRow =
  Database["public"]["Tables"]["coaching_bookings"]["Row"];
type CourtOption = { id: string; name: string };
type CourtBusyRow = {
  court_id: string;
  starts_at: string;
  ends_at: string;
};

const CARD = "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5";

type AvailabilityDraft = {
  key: string;
  days: number[];
  startHour: number;
  endHour: number;
};

function emptyWindow(): AvailabilityDraft {
  return {
    key: `w_${Math.random().toString(36).slice(2, 8)}`,
    days: [1],
    startHour: 9,
    endHour: 17,
  };
}

function draftsFromAvailability(
  availability: CoachAvailabilityWindow[],
): AvailabilityDraft[] {
  if (availability.length === 0) return [emptyWindow()];
  return groupAvailabilityByHours(availability).map((group) => ({
    key: `w_${Math.random().toString(36).slice(2, 8)}`,
    days: group.days,
    startHour: group.startHour,
    endHour: group.endHour,
  }));
}

function AvailabilityFields({
  windows,
  onChange,
}: {
  windows: AvailabilityDraft[];
  onChange: (windows: AvailabilityDraft[]) => void;
}) {
  return (
    <div className="space-y-2 md:col-span-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Weekly availability</Label>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => onChange([...windows, emptyWindow()])}
        >
          Add different hours
        </Button>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Toggle every day this coach takes sessions. Use another row when hours
        differ by day.
      </p>
      {windows.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">
          No windows yet — pick days and hours this coach takes sessions.
        </p>
      ) : null}
      <div className="space-y-2">
        {windows.map((window, index) => (
          <div
            key={window.key}
            className="space-y-2 rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-2"
          >
            {window.days.map((day) => (
              <span key={day}>
                <input type="hidden" name="availabilityDay" value={day} />
                <input
                  type="hidden"
                  name="availabilityStart"
                  value={window.startHour}
                />
                <input
                  type="hidden"
                  name="availabilityEnd"
                  value={window.endHour}
                />
              </span>
            ))}
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label={`Available days ${index + 1}`}
            >
              {WEEKDAY_LABELS.map((label, day) => {
                const selected = window.days.includes(day);
                return (
                  <Button
                    key={label}
                    type="button"
                    size="sm"
                    variant={selected ? "default" : "secondary"}
                    aria-pressed={selected}
                    onClick={() => {
                      const next = [...windows];
                      next[index] = {
                        ...window,
                        days: selected
                          ? window.days.filter((item) => item !== day)
                          : [...window.days, day].sort((a, b) => a - b),
                      };
                      onChange(next);
                    }}
                  >
                    {label.slice(0, 3)}
                  </Button>
                );
              })}
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <select
                aria-label={`Availability start ${index + 1}`}
                value={window.startHour}
                onChange={(event) => {
                  const next = [...windows];
                  next[index] = {
                    ...window,
                    startHour: Number(event.target.value),
                  };
                  onChange(next);
                }}
                className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm"
              >
                {bookingOpenHourOptions().map((hour) => (
                  <option key={hour} value={hour}>
                    {formatBookingHourLabel(hour)}
                  </option>
                ))}
              </select>
              <select
                aria-label={`Availability end ${index + 1}`}
                value={window.endHour}
                onChange={(event) => {
                  const next = [...windows];
                  next[index] = {
                    ...window,
                    endHour: Number(event.target.value),
                  };
                  onChange(next);
                }}
                className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm"
              >
                {bookingCloseHourOptions().map((hour) => (
                  <option key={hour} value={hour}>
                    {hour === 24 ? "Midnight" : formatBookingHourLabel(hour)}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-red-700"
                onClick={() =>
                  onChange(windows.filter((item) => item.key !== window.key))
                }
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatAvailabilitySummary(
  availability: CoachAvailabilityWindow[],
): string {
  if (availability.length === 0) return "No availability set";
  return availability
    .map(
      (window) =>
        `${WEEKDAY_LABELS[window.dayOfWeek]?.slice(0, 3)} ${formatBookingHourLabel(window.startHour)}–${
          window.endHour === 24
            ? "midnight"
            : formatBookingHourLabel(window.endHour)
        }`,
    )
    .join(" · ");
}

export function CoachingManager({
  venueId,
  coaches,
  bookings,
  courts,
  courtBusy,
  grid,
  timeZone,
}: {
  venueId: string;
  coaches: CoachWithAvailability[];
  bookings: CoachingBookingRow[];
  courts: CourtOption[];
  courtBusy: CourtBusyRow[];
  grid: HourlySlotGrid;
  timeZone: string;
}) {
  const hydrated = useHydrated();
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [addCoachOpen, setAddCoachOpen] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectedBookingRange | null>(null);
  const [courtId, setCourtId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createWindows, setCreateWindows] = useState<AvailabilityDraft[]>([
    emptyWindow(),
  ]);
  const [editWindows, setEditWindows] = useState<AvailabilityDraft[]>([]);

  const activeBusyKey = pending ? busyKey : null;
  const activeCoaches = coaches.filter((coach) => coach.active);
  const requests = bookings.filter((booking) => booking.status === "pending");
  const upcoming = bookings.filter((booking) => booking.status === "confirmed");

  const coachName = useMemo(() => {
    const byId = new Map(coaches.map((coach) => [coach.id, coach.name]));
    return (id: string) => byId.get(id) ?? "Removed coach";
  }, [coaches]);

  const courtName = useMemo(() => {
    const byId = new Map(courts.map((court) => [court.id, court.name]));
    return (id: string) => byId.get(id) ?? "Removed court";
  }, [courts]);

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
    return `${selection.courtName} · ${formatDateAndTimeRange(
      selection.startsAt,
      selection.endsAt,
      { timeZone },
    )} (${hours})`;
  }, [hydrated, selection, timeZone]);

  const selectedCoachRate = useMemo(() => {
    if (!selection) return null;
    return (
      coaches.find((coach) => coach.id === selection.courtId)?.rateCents ?? null
    );
  }, [coaches, selection]);

  function runAction(
    key: string,
    formData: FormData,
    action: (data: FormData) => Promise<CoachingActionResult>,
    onSuccess: () => void,
    setError: (message: string | null) => void,
  ) {
    setBusyKey(key);
    setError(null);
    startTransition(async () => {
      const result = await action(formData);
      if ("error" in result) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      onSuccess();
    });
  }

  function startEdit(coach: CoachWithAvailability) {
    setEditingId(coach.id);
    setEditWindows(draftsFromAvailability(coach.availability));
    setCoachError(null);
  }

  return (
    <div className="space-y-4">
      <section className={CARD}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="mb-1 font-semibold">Coaches</h2>
            <p className="text-sm text-[var(--muted)]">
              Manage coaches, rates, and weekly availability. Booking slots only
              appear inside those windows.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => {
              setCreateWindows([emptyWindow()]);
              setCoachError(null);
              setAddCoachOpen(true);
            }}
          >
            Add Coach
          </Button>
        </div>

        {coaches.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No coaches yet. Use Add Coach to start taking coaching sessions.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
            {coaches.map((coach) => (
              <li key={coach.id} className="space-y-3 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {coach.name}
                      {!coach.active ? (
                        <span className="ml-2 text-xs text-[var(--muted)]">
                          (inactive)
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {formatPriceCents(coach.rateCents)}/hr ·{" "}
                      {formatAvailabilitySummary(coach.availability)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => startEdit(coach)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      loading={activeBusyKey === `active-${coach.id}`}
                      disabled={pending}
                      onClick={() => {
                        const data = new FormData();
                        data.set("coachId", coach.id);
                        data.set("active", coach.active ? "false" : "true");
                        runAction(
                          `active-${coach.id}`,
                          data,
                          setCoachActiveAction,
                          () =>
                            toast.success(
                              coach.active
                                ? "Coach deactivated."
                                : "Coach activated.",
                            ),
                          setCoachError,
                        );
                      }}
                    >
                      {coach.active ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </div>

                {editingId === coach.id ? (
                  <form
                    className="grid gap-3 border-t border-[var(--border)] pt-3 md:grid-cols-2"
                    action={(formData) =>
                      runAction(
                        `edit-${coach.id}`,
                        formData,
                        updateCoachAction,
                        () => {
                          setEditingId(null);
                          toast.success("Coach updated.");
                        },
                        setCoachError,
                      )
                    }
                  >
                    <input type="hidden" name="coachId" value={coach.id} />
                    <input
                      type="hidden"
                      name="active"
                      value={String(coach.active)}
                    />
                    <div className="space-y-1">
                      <Label htmlFor={`edit-name-${coach.id}`}>Name</Label>
                      <Input
                        id={`edit-name-${coach.id}`}
                        name="name"
                        defaultValue={coach.name}
                        required
                        maxLength={120}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`edit-rate-${coach.id}`}>
                        Hourly rate
                      </Label>
                      <Input
                        id={`edit-rate-${coach.id}`}
                        name="rate"
                        type="number"
                        min={0}
                        step="0.01"
                        defaultValue={(coach.rateCents / 100).toFixed(2)}
                        required
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor={`edit-notes-${coach.id}`}>Notes</Label>
                      <Input
                        id={`edit-notes-${coach.id}`}
                        name="notes"
                        defaultValue={coach.notes ?? ""}
                        maxLength={1000}
                      />
                    </div>
                    <AvailabilityFields
                      windows={editWindows}
                      onChange={setEditWindows}
                    />
                    {coachError ? (
                      <p
                        role="alert"
                        className="text-sm text-red-700 md:col-span-2"
                      >
                        {coachError}
                      </p>
                    ) : null}
                    <div className="flex gap-2 md:col-span-2">
                      <Button
                        type="submit"
                        loading={activeBusyKey === `edit-${coach.id}`}
                        disabled={pending}
                      >
                        Save coach
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <Dialog
          open={addCoachOpen}
          onOpenChange={(open) => {
            setAddCoachOpen(open);
            if (!open) {
              setCoachError(null);
              setCreateWindows([emptyWindow()]);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Coach</DialogTitle>
              <DialogDescription>
                Set a rate and toggle every day they take sessions. Add another
                hours row only when days differ.
              </DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-3 md:grid-cols-2"
              action={(formData) =>
                runAction(
                  "create-coach",
                  formData,
                  createCoachAction,
                  () => {
                    setCreateWindows([emptyWindow()]);
                    setAddCoachOpen(false);
                    toast.success("Coach added.");
                  },
                  setCoachError,
                )
              }
            >
              <input type="hidden" name="venueId" value={venueId} />
              <div className="space-y-1">
                <Label htmlFor="coach-name">Name</Label>
                <Input
                  id="coach-name"
                  name="name"
                  placeholder="Coach name"
                  required
                  maxLength={120}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="coach-rate">Hourly rate</Label>
                <Input
                  id="coach-rate"
                  name="rate"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="coach-notes">Notes</Label>
                <Input
                  id="coach-notes"
                  name="notes"
                  maxLength={1000}
                  placeholder="Focus areas, skill levels, etc."
                />
              </div>
              <AvailabilityFields
                windows={createWindows}
                onChange={setCreateWindows}
              />
              {coachError ? (
                <p role="alert" className="text-sm text-red-700 md:col-span-2">
                  {coachError}
                </p>
              ) : null}
              <DialogFooter className="md:col-span-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setAddCoachOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={activeBusyKey === "create-coach"}
                  disabled={pending}
                >
                  Add coach
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </section>

      <section className="space-y-4">
        {activeCoaches.length === 0 ? (
          <div className={CARD}>
            <h2 className="mb-1 font-semibold">Book a coaching session</h2>
            <p className="text-sm text-[var(--muted)]">
              Activate a coach with weekly availability to open the booking
              calendar.
            </p>
          </div>
        ) : (
          <>
            <BookingSlotPicker
              grid={grid}
              courts={activeCoaches.map((coach) => ({
                id: coach.id,
                name: coach.name,
              }))}
              timeZone={timeZone}
              selection={selection}
              onSelect={(next) => {
                setSelection(next);
                setCourtId("");
              }}
              resourceLabel="Coach"
              title="Pick coach & time"
              description={
                <>
                  Rows are coaches. Open slots are inside their weekly
                  availability; · means they are not available that hour. Then
                  pick a free court for that window so rentals and open play
                  stay clear.
                </>
              }
            />

            <section className={CARD}>
              <h2 className="mb-1 font-semibold">Book coaching session</h2>
              <p className="mb-4 text-sm text-[var(--muted)]">
                Sessions are confirmed immediately. Price defaults to the
                coach&apos;s hourly rate × hours selected. A court is required
                because the session occupies one.
              </p>

              <form
                className="grid gap-3 md:grid-cols-2"
                action={(formData) =>
                  runAction(
                    "create-session",
                    formData,
                    createCoachingBookingAction,
                    () => {
                      setSelection(null);
                      setCourtId("");
                      toast.success("Coaching session booked.");
                    },
                    setBookingError,
                  )
                }
              >
                <input type="hidden" name="venueId" value={venueId} />
                <input type="hidden" name="timeZone" value={timeZone} />
                {selection ? (
                  <>
                    <input
                      type="hidden"
                      name="coachId"
                      value={selection.courtId}
                    />
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
                    {selectionLabel ? (
                      <>
                        {selectionLabel}
                        {selectedCoachRate != null ? (
                          <span className="text-[var(--muted)]">
                            {" "}
                            · est.{" "}
                            {formatPriceCents(
                              selectedCoachRate * selection!.hours.length,
                            )}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-[var(--muted)]">
                        Tap an open coach slot above.
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="coaching-court">Court</Label>
                  <select
                    id="coaching-court"
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
                  <Label htmlFor="coaching-client">Booked for</Label>
                  <Input
                    id="coaching-client"
                    name="bookedByName"
                    placeholder="Player or client name"
                    maxLength={120}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="coaching-phone">Phone</Label>
                  <Input id="coaching-phone" name="contactPhone" type="tel" />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="coaching-email">Email</Label>
                  <Input id="coaching-email" name="contactEmail" type="email" />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="coaching-payment">Payment</Label>
                  <select
                    id="coaching-payment"
                    name="paymentStatus"
                    defaultValue="unpaid"
                    className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 text-sm"
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="coaching-notes">Notes</Label>
                  <Input
                    id="coaching-notes"
                    name="notes"
                    maxLength={1000}
                    placeholder="Focus for the session, court preference, etc."
                  />
                </div>

                {bookingError ? (
                  <p
                    role="alert"
                    className="text-sm text-red-700 md:col-span-2"
                  >
                    {bookingError}
                  </p>
                ) : null}

                <div className="md:col-span-2">
                  <Button
                    type="submit"
                    loading={activeBusyKey === "create-session"}
                    disabled={pending || !selection || !courtId}
                  >
                    Book session
                  </Button>
                </div>
              </form>
            </section>
          </>
        )}
      </section>

      {requests.length > 0 ? (
        <section className={CARD}>
          <h2 className="mb-3 font-semibold">Coaching requests</h2>
          <ul className="divide-y divide-[var(--border)]">
            {requests.map((booking) => (
              <li
                key={booking.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <div>
                  <div className="font-medium">
                    {coachName(booking.coach_id)} ·{" "}
                    {courtName(booking.court_id)} · {booking.booked_by_name}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {hydrated
                      ? formatDateAndTimeRange(
                          new Date(booking.starts_at).getTime(),
                          new Date(booking.ends_at).getTime(),
                          { timeZone },
                        )
                      : "\u00a0"}
                    {" · "}
                    {formatPriceCents(booking.price_cents)} · pending
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    loading={activeBusyKey === `approve-${booking.id}`}
                    disabled={pending}
                    onClick={() => {
                      const data = new FormData();
                      data.set("bookingId", booking.id);
                      data.set("status", "confirmed");
                      runAction(
                        `approve-${booking.id}`,
                        data,
                        setCoachingBookingStatusAction,
                        () => toast.success("Coaching request approved."),
                        setBookingError,
                      );
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-red-700"
                    loading={activeBusyKey === `decline-${booking.id}`}
                    disabled={pending}
                    onClick={() => {
                      const data = new FormData();
                      data.set("bookingId", booking.id);
                      data.set("status", "cancelled");
                      runAction(
                        `decline-${booking.id}`,
                        data,
                        setCoachingBookingStatusAction,
                        () => toast.success("Coaching request declined."),
                        setBookingError,
                      );
                    }}
                  >
                    Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {upcoming.length > 0 ? (
        <section className={CARD}>
          <h2 className="mb-3 font-semibold">Upcoming coaching sessions</h2>
          <ul className="divide-y divide-[var(--border)]">
            {upcoming.map((booking) => (
              <li
                key={booking.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <div>
                  <div className="font-medium">
                    {coachName(booking.coach_id)} ·{" "}
                    {courtName(booking.court_id)} · {booking.booked_by_name}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {hydrated
                      ? formatDateAndTimeRange(
                          new Date(booking.starts_at).getTime(),
                          new Date(booking.ends_at).getTime(),
                          { timeZone },
                        )
                      : "\u00a0"}
                    {" · "}
                    {formatPriceCents(booking.price_cents)} ·{" "}
                    {booking.payment_status}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-red-700"
                  loading={activeBusyKey === `cancel-${booking.id}`}
                  disabled={pending}
                  onClick={() => {
                    const data = new FormData();
                    data.set("bookingId", booking.id);
                    runAction(
                      `cancel-${booking.id}`,
                      data,
                      cancelCoachingBookingAction,
                      () => toast.success("Session cancelled."),
                      setBookingError,
                    );
                  }}
                >
                  Cancel
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
