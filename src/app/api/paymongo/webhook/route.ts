import { NextResponse } from "next/server";
import {
  nextClubPeriodEnd,
  passFromCheckoutMetadata,
} from "@/lib/entitlements";
import {
  paidCheckoutFromWebhook,
  paymongoLivemode,
  paymongoSignatureMatches,
} from "@/lib/paymongo";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

const PG_UNIQUE_VIOLATION = "23505";

async function fulfill(checkout: {
  id: string;
  metadata: Record<string, string>;
}) {
  const facilityId = checkout.metadata.facility_id;
  const kind = checkout.metadata.kind;
  if (
    !facilityId ||
    (kind !== "club" && kind !== "day" && kind !== "weekend")
  ) {
    return;
  }

  const supabase = createServiceClient();
  const { error: claimed } = await supabase.from("paymongo_payments").insert({
    checkout_id: checkout.id,
    facility_id: facilityId,
    kind,
  });
  if (claimed?.code === PG_UNIQUE_VIOLATION) return;
  if (claimed) {
    console.error("[billing] payment claim failed", claimed.code);
    throw new Error("payment claim failed");
  }

  try {
    if (kind === "club") {
      const { data: billing, error: loadError } = await supabase
        .from("facility_billing")
        .select("trial_ends_at, club_period_end")
        .eq("facility_id", facilityId)
        .maybeSingle();
      if (loadError) {
        console.error("[billing] club load failed", loadError.code);
        throw new Error("club load failed");
      }
      const now = new Date();
      const periodEnd = nextClubPeriodEnd(
        now,
        billing?.club_period_end ?? null,
      );
      const { error } = await supabase.from("facility_billing").upsert({
        facility_id: facilityId,
        trial_ends_at:
          billing?.trial_ends_at ??
          new Date(now.getTime() - 1000).toISOString(),
        club_status: "active",
        club_period_end: periodEnd.toISOString(),
        updated_at: now.toISOString(),
      });
      if (error) {
        console.error("[billing] club update failed", error.code);
        throw new Error("club update failed");
      }
      return;
    }

    const pass = passFromCheckoutMetadata(checkout.metadata);
    if (!pass) {
      console.error("[billing] pass metadata rejected");
      return;
    }
    const { error } = await supabase.from("tournament_passes").insert({
      facility_id: facilityId,
      kind: pass.kind,
      starts_on: pass.startsOn,
      ends_on: pass.endsOn,
      paymongo_checkout_id: checkout.id,
    });
    if (error && error.code !== PG_UNIQUE_VIOLATION) {
      console.error("[billing] pass insert failed", error.code);
      throw new Error("pass insert failed");
    }
  } catch (error) {
    await supabase
      .from("paymongo_payments")
      .delete()
      .eq("checkout_id", checkout.id);
    throw error;
  }
}

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
    await fulfill(checkout);
  } catch (error) {
    console.error(
      "[billing] webhook failed",
      error instanceof Error ? error.name : "error",
    );
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
