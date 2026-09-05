import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  formatDateAndTimeRange,
  formatPriceCents,
  parseBookingRequestStatus,
} from "@/lib/bookings";
import { parseCoachingRequestStatus } from "@/lib/coaching";
import { createClient } from "@/lib/supabase/server";

function StatusMessage({
  status,
  declineReason,
  confirmedCopy,
}: {
  status: "pending" | "confirmed" | "cancelled";
  declineReason: string | null;
  confirmedCopy: string;
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
        {confirmedCopy}
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

  const { data: courtJson } = await supabase.rpc("get_booking_request_status", {
    p_token: token,
  });
  const courtStatus = parseBookingRequestStatus(courtJson);

  const { data: coachingJson } = courtStatus
    ? { data: null }
    : await supabase.rpc("get_coaching_request_status", { p_token: token });
  const coachingStatus = parseCoachingRequestStatus(coachingJson);

  const status = courtStatus
    ? {
        kind: "court" as const,
        status: courtStatus.status,
        bookedByName: courtStatus.bookedByName,
        startsAt: courtStatus.startsAt,
        endsAt: courtStatus.endsAt,
        venueName: courtStatus.venueName,
        venueSlug: courtStatus.venueSlug,
        venueTimezone: courtStatus.venueTimezone,
        declineReason: courtStatus.declineReason,
        resourceLabel: courtStatus.courtName,
        courtName: null as string | null,
        confirmedCopy: "Your court is confirmed. See you on the court!",
        priceCents: null as number | null,
      }
    : coachingStatus
      ? {
          kind: "coaching" as const,
          status: coachingStatus.status,
          bookedByName: coachingStatus.bookedByName,
          startsAt: coachingStatus.startsAt,
          endsAt: coachingStatus.endsAt,
          venueName: coachingStatus.venueName,
          venueSlug: coachingStatus.venueSlug,
          venueTimezone: coachingStatus.venueTimezone,
          declineReason: null as string | null,
          resourceLabel: coachingStatus.coachName,
          courtName: coachingStatus.courtName,
          confirmedCopy: "Your coaching session is confirmed. See you soon!",
          priceCents: coachingStatus.priceCents,
        }
      : null;

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
          {status.kind === "coaching" ? "Coaching request" : "Booking request"}
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
          <p className="text-sm text-[var(--muted)]">
            {status.kind === "coaching"
              ? "Coach, court & time"
              : "Court & time"}
          </p>
          <p className="font-medium">
            {status.kind === "coaching" && status.courtName
              ? `${status.resourceLabel} · ${status.courtName} · ${timeLabel}`
              : `${status.resourceLabel} · ${timeLabel}`}
          </p>
        </div>
        {status.kind === "coaching" && status.priceCents != null ? (
          <div>
            <p className="text-sm text-[var(--muted)]">Estimated price</p>
            <p className="font-medium">{formatPriceCents(status.priceCents)}</p>
          </div>
        ) : null}

        <StatusMessage
          status={status.status}
          declineReason={status.declineReason}
          confirmedCopy={status.confirmedCopy}
        />
      </section>

      <Button asChild variant="secondary">
        <Link href={`/book/${slug}`}>Make another request</Link>
      </Button>
    </main>
  );
}
