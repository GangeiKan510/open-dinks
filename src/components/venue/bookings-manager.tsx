"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Link2, PenLine, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import {
  createBookingAction,
  declineBookingRequestAction,
  deleteBookingAction,
  setBookingStatusAction,
  type BookingActionResult,
} from "@/app/actions/bookings";
import { BookingScheduleCalendar } from "@/components/venue/booking-schedule-calendar";
import {
  BookingSlotPicker,
  type SelectedBookingRange,
} from "@/components/venue/booking-slot-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsBadge,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  parseScheduleBookings,
  type HourlySlotGrid,
} from "@/lib/booking-calendar";
import { formatDateAndTimeRange, formatPriceCents } from "@/lib/bookings";
import { useHydrated } from "@/lib/use-hydrated";
import type { Database } from "@/lib/supabase/database.types";

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
type CourtRow = Database["public"]["Tables"]["courts"]["Row"];

const CARD = "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5";

function BookingSchedule({
  booking,
  timeZone,
}: {
  booking: BookingRow;
  timeZone: string;
}) {
  const hydrated = useHydrated();
  if (!hydrated) return <span className="text-[var(--muted)]">&nbsp;</span>;
  return (
    <span className="text-[var(--muted)]">
      {formatDateAndTimeRange(
        new Date(booking.starts_at).getTime(),
        new Date(booking.ends_at).getTime(),
        { timeZone },
      )}
    </span>
  );
}

function ContactLine({ booking }: { booking: BookingRow }) {
  const parts = [booking.contact_phone, booking.contact_email].filter(Boolean);
  if (parts.length === 0) return null;
  return <div className="text-xs text-[var(--muted)]">{parts.join(" · ")}</div>;
}

export function BookingsManager({
  venueId,
  courts,
  bookings,
  grid,
  timeZone,
  publicBookingUrl,
  bookingPath,
}: {
  venueId: string;
  courts: CourtRow[];
  bookings: BookingRow[];
  grid: HourlySlotGrid;
  timeZone: string;
  publicBookingUrl: string;
  bookingPath: string;
}) {
  const hydrated = useHydrated();
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectedBookingRange | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(
    null,
  );
  const [declineReason, setDeclineReason] = useState("");
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [declineError, setDeclineError] = useState<string | null>(null);

  const courtName = useMemo(() => {
    const byId = new Map(courts.map((court) => [court.id, court.name]));
    return (id: string) => byId.get(id) ?? "Removed court";
  }, [courts]);

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

  const requests = bookings.filter((b) => b.status === "pending");
  const upcoming = bookings.filter((b) => b.status === "confirmed");
  const scheduleBookings = useMemo(
    () => parseScheduleBookings([...requests, ...upcoming]),
    [requests, upcoming],
  );
  const selectedScheduleBooking = useMemo(
    () => bookings.find((booking) => booking.id === selectedScheduleId) ?? null,
    [bookings, selectedScheduleId],
  );

  const activeBusyKey = pending ? busyKey : null;

  function run(key: string, action: () => Promise<BookingActionResult>) {
    setBusyKey(key);
    startTransition(async () => {
      const result = await action();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setSelectedScheduleId(null);
      setShowDeclineForm(false);
      setDeclineReason("");
      setDeclineError(null);
      toast.success("Bookings updated.");
    });
  }

  function onDecline(formData: FormData) {
    if (!selectedScheduleBooking) return;
    setBusyKey(`decline-${selectedScheduleBooking.id}`);
    setDeclineError(null);
    startTransition(async () => {
      const result = await declineBookingRequestAction(
        selectedScheduleBooking.id,
        formData,
      );
      if ("error" in result) {
        setDeclineError(result.error);
        toast.error(result.error);
        return;
      }
      setSelectedScheduleId(null);
      setShowDeclineForm(false);
      setDeclineReason("");
      toast.success("Request declined. The guest can check their status link.");
    });
  }

  function onCreate(formData: FormData) {
    if (!selection) {
      setFormError("Pick at least one open hour on the calendar first.");
      return;
    }

    setBusyKey("create");
    setFormError(null);
    startTransition(async () => {
      const result = await createBookingAction(formData);
      if ("error" in result) {
        setFormError(result.error);
        toast.error(result.error);
        return;
      }
      setSelection(null);
      toast.success("Court booked.");
    });
  }

  if (courts.length === 0) {
    return (
      <section className={CARD}>
        <h2 className="mb-1 font-semibold">Court bookings</h2>
        <p className="text-sm text-[var(--muted)]">
          Add a court to this venue before taking bookings.
        </p>
      </section>
    );
  }

  return (
    <Tabs defaultValue="create">
      <TabsList aria-label="Booking sections">
        <TabsTrigger value="create">
          <PenLine className="h-4 w-4 shrink-0" aria-hidden />
          Create booking
        </TabsTrigger>
        <TabsTrigger value="schedule">
          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
          Requests & schedule
          <TabsBadge count={requests.length} tone="attention" />
          <TabsBadge count={upcoming.length} />
        </TabsTrigger>
        <TabsTrigger value="share">
          <Link2 className="h-4 w-4 shrink-0" aria-hidden />
          Share
        </TabsTrigger>
      </TabsList>

      <TabsContent value="create" className="space-y-4">
        <BookingSlotPicker
          grid={grid}
          courts={courts}
          timeZone={timeZone}
          selection={selection}
          onSelect={setSelection}
        />

        <section className={CARD}>
          <h2 className="mb-1 font-semibold">Create booking</h2>
          <p className="mb-4 text-sm text-[var(--muted)]">
            Staff bookings are confirmed immediately and take the court off the
            wallboard for that window.
          </p>

          <form action={onCreate} className="grid gap-3 md:grid-cols-2">
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
              <Label htmlFor="booking-name">Booked by</Label>
              <Input
                id="booking-name"
                name="bookedByName"
                placeholder="Name on the reservation"
                maxLength={120}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="booking-phone">Phone</Label>
              <Input id="booking-phone" name="contactPhone" type="tel" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="booking-email">Email</Label>
              <Input id="booking-email" name="contactEmail" type="email" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="booking-price">Price</Label>
              <Input
                id="booking-price"
                name="price"
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="booking-payment">Payment</Label>
              <select
                id="booking-payment"
                name="paymentStatus"
                defaultValue="unpaid"
                className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 text-sm"
              >
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
              </select>
            </div>

            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="booking-notes">Notes</Label>
              <Input
                id="booking-notes"
                name="notes"
                maxLength={1000}
                placeholder="Coaching clinic, tournament hold, etc."
              />
            </div>

            {formError ? (
              <p role="alert" className="text-sm text-red-700 md:col-span-2">
                {formError}
              </p>
            ) : null}

            <div className="md:col-span-2">
              <Button
                type="submit"
                loading={activeBusyKey === "create"}
                disabled={pending || !selection}
              >
                Book court
              </Button>
            </div>
          </form>
        </section>
      </TabsContent>

      <TabsContent value="schedule" className="space-y-4">
        <BookingScheduleCalendar
          grid={grid}
          courts={courts}
          bookings={scheduleBookings}
          timeZone={timeZone}
          selectedBookingId={selectedScheduleId}
          onSelectBooking={(bookingId) => {
            setSelectedScheduleId(bookingId);
            setShowDeclineForm(false);
            setDeclineReason("");
            setDeclineError(null);
          }}
        />

        {selectedScheduleBooking ? (
          <section className={`${CARD} space-y-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">
                  {selectedScheduleBooking.booked_by_name}
                </h2>
                <p className="text-sm text-[var(--muted)]">
                  {courtName(selectedScheduleBooking.court_id)} ·{" "}
                  <BookingSchedule
                    booking={selectedScheduleBooking}
                    timeZone={timeZone}
                  />
                </p>
                <ContactLine booking={selectedScheduleBooking} />
                {selectedScheduleBooking.notes ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {selectedScheduleBooking.notes}
                  </p>
                ) : null}
                {selectedScheduleBooking.status === "confirmed" ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {formatPriceCents(selectedScheduleBooking.price_cents)} ·{" "}
                    {selectedScheduleBooking.payment_status}
                  </p>
                ) : null}
              </div>
              <span
                className={
                  selectedScheduleBooking.status === "pending"
                    ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-950"
                    : "rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--accent)]"
                }
              >
                {selectedScheduleBooking.status === "pending"
                  ? "Pending request"
                  : "Confirmed"}
              </span>
            </div>

            {selectedScheduleBooking.status === "pending" ? (
              <div className="space-y-3">
                {!showDeclineForm ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      loading={
                        activeBusyKey ===
                        `approve-${selectedScheduleBooking.id}`
                      }
                      disabled={pending}
                      onClick={() =>
                        run(`approve-${selectedScheduleBooking.id}`, () =>
                          setBookingStatusAction(
                            selectedScheduleBooking.id,
                            "confirmed",
                          ),
                        )
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => setShowDeclineForm(true)}
                    >
                      Decline
                    </Button>
                  </div>
                ) : (
                  <form action={onDecline} className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="decline-reason">
                        Reason for declining
                      </Label>
                      <textarea
                        id="decline-reason"
                        name="declineReason"
                        value={declineReason}
                        onChange={(event) =>
                          setDeclineReason(event.target.value)
                        }
                        required
                        maxLength={500}
                        rows={3}
                        placeholder="Court already reserved for a clinic, try a later hour, etc."
                        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
                      />
                      <p className="text-xs text-[var(--muted)]">
                        The guest sees this on their status page and in email
                        when an address was provided.
                      </p>
                    </div>
                    {declineError ? (
                      <p role="alert" className="text-sm text-red-700">
                        {declineError}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        variant="danger"
                        loading={
                          activeBusyKey ===
                          `decline-${selectedScheduleBooking.id}`
                        }
                        disabled={pending || !declineReason.trim()}
                      >
                        Confirm decline
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => {
                          setShowDeclineForm(false);
                          setDeclineReason("");
                          setDeclineError(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  loading={
                    activeBusyKey === `cancel-${selectedScheduleBooking.id}`
                  }
                  disabled={pending}
                  onClick={() =>
                    run(`cancel-${selectedScheduleBooking.id}`, () =>
                      setBookingStatusAction(
                        selectedScheduleBooking.id,
                        "cancelled",
                      ),
                    )
                  }
                >
                  Cancel booking
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-700 hover:bg-red-50 hover:text-red-800"
                  loading={
                    activeBusyKey === `delete-${selectedScheduleBooking.id}`
                  }
                  disabled={pending}
                  onClick={() =>
                    run(`delete-${selectedScheduleBooking.id}`, () =>
                      deleteBookingAction(selectedScheduleBooking.id),
                    )
                  }
                >
                  Delete
                </Button>
              </div>
            )}
          </section>
        ) : null}
      </TabsContent>

      <TabsContent value="share">
        <section className={CARD}>
          <h2 className="mb-1 font-semibold">Public booking link</h2>
          <p className="mb-3 text-sm text-[var(--muted)]">
            Share this link so players can request a court. Requests arrive as
            pending in Requests & schedule and only block open play once you
            approve them.
          </p>
          <code className="block break-all rounded-md bg-[var(--surface-2)] px-3 py-2 text-sm">
            {publicBookingUrl}
          </code>
          <Link
            href={bookingPath}
            className="mt-3 inline-block text-sm text-[var(--accent)] underline"
          >
            Open booking page
          </Link>
        </section>
      </TabsContent>
    </Tabs>
  );
}
