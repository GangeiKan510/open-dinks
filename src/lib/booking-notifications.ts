import { formatDateAndTimeRange } from "@/lib/bookings";
import { siteUrl } from "@/lib/env";

type DeclinedEmailInput = {
  to: string;
  venueName: string;
  bookedByName: string;
  startsAt: number;
  endsAt: number;
  timeZone: string;
  declineReason: string;
  statusUrl: string;
};

export function bookingStatusUrl(slug: string, token: string): string {
  return `${siteUrl()}/book/${slug}/status/${token}`;
}

function declinedEmailHtml(input: DeclinedEmailInput): string {
  const timeLabel = formatDateAndTimeRange(input.startsAt, input.endsAt, {
    timeZone: input.timeZone,
  });
  return `
    <p>Hi ${input.bookedByName},</p>
    <p>Your court request at <strong>${input.venueName}</strong> for ${timeLabel} was not approved.</p>
    <p><strong>Reason:</strong> ${input.declineReason}</p>
    <p>You can view the full status any time:</p>
    <p><a href="${input.statusUrl}">${input.statusUrl}</a></p>
  `.trim();
}

/** Sends via Resend when configured; otherwise logs and returns sent=false. */
export async function sendBookingDeclinedEmail(
  input: DeclinedEmailInput,
): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.BOOKING_EMAIL_FROM;
  const subject = `Update on your court request at ${input.venueName}`;
  const html = declinedEmailHtml(input);

  if (!apiKey || !from) {
    console.info(
      "[booking-notifications] email skipped (RESEND_API_KEY or BOOKING_EMAIL_FROM unset)",
      { to: input.to, subject },
    );
    return { sent: false };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      console.error(
        "[booking-notifications] Resend error",
        await response.text(),
      );
      return { sent: false };
    }

    return { sent: true };
  } catch (error) {
    console.error("[booking-notifications] send failed", error);
    return { sent: false };
  }
}
