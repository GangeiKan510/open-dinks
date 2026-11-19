import { NextResponse } from "next/server";
import { fulfillPaidCheckout } from "@/lib/billing-fulfill";
import {
  paidCheckoutFromWebhook,
  paymongoLivemode,
  paymongoSignatureMatches,
} from "@/lib/paymongo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!secret || !process.env.PAYMONGO_SECRET_KEY) {
    return NextResponse.json({ error: "unconfigured" }, { status: 500 });
  }

  const signature = request.headers.get("paymongo-signature");
  const rawBody = await request.text();
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const checkout = paidCheckoutFromWebhook(body);
  if (
    !paymongoSignatureMatches({
      header: signature,
      rawBody,
      secret,
      livemode: checkout?.livemode ?? paymongoLivemode(body),
      nowSeconds: Math.floor(Date.now() / 1000),
    })
  ) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }
  if (!checkout) return NextResponse.json({ received: true });

  try {
    await fulfillPaidCheckout(checkout);
  } catch (error) {
    console.error(
      "[billing] webhook failed",
      error instanceof Error ? error.name : "error",
    );
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
