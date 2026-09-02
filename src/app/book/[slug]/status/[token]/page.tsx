import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  formatDateAndTimeRange,
  parseBookingRequestStatus,
} from "@/lib/bookings";
import { createClient } from "@/lib/supabase/server";

function StatusMessage({
  status,
  declineReason,
}: {
  status: "pending" | "confirmed" | "cancelled";
  declineReason: string | null;
}) {
  if (status === "pending") {
    return (
      <p className="rounded-lg border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm">
        Waiting for the venue to review your request. Check back here for
        updates.
      </p>
    );
  }

  if (status === "confirmed") {
    return (
      <p className="rounded-lg border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-4 py-3 text-sm">
        Your court is confirmed. See you on the court!
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
      <p className="font-medium">This request was not approved.</p>
      {declineReason ? (
        <p>
          <span className="font-medium">Reason:</span> {declineReason}
        </p>
      ) : (
        <p>The venue cancelled this request.</p>
      )}
    </div>
  );
}

export default async function BookingRequestStatusPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const supabase = await createClient();

  const { data: statusJson } = await supabase.rpc(
    "get_booking_request_status",
    {
      p_token: token,
    },
  );
  const status = parseBookingRequestStatus(statusJson);
  if (!status || status.venueSlug !== slug) notFound();

  const startsAt = new Date(status.startsAt).getTime();
  const endsAt = new Date(status.endsAt).getTime();
  const timeLabel = formatDateAndTimeRange(startsAt, endsAt, {
    timeZone: status.venueTimezone,
  });

  return (
    <main className="mx-auto max-w-lg space-y-6 px-6 py-10">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          Booking request
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          {status.venueName}
        </h1>
      </header>

      <section className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div>
          <p className="text-sm text-[var(--muted)]">Reserved for</p>
          <p className="font-medium">{status.bookedByName}</p>
        </div>
        <div>
          <p className="text-sm text-[var(--muted)]">Court & time</p>
          <p className="font-medium">
            {status.courtName} · {timeLabel}
          </p>
        </div>

        <StatusMessage
          status={status.status}
          declineReason={status.declineReason}
        />
      </section>

      <Button asChild variant="secondary">
        <Link href={`/book/${slug}`}>Make another request</Link>
      </Button>
    </main>
  );
}
