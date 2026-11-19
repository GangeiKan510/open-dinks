import { cookies } from "next/headers";
import { catalogCentavos } from "@/lib/admin-sales";
import {
  nextClubPeriodEnd,
  passFromCheckoutMetadata,
} from "@/lib/entitlements";
import {
  listRecentPaidPayments,
  paymentPlanForFacility,
  retrievePaidCheckout,
} from "@/lib/paymongo";
import {
  isServiceRoleConfigured,
  createServiceClient,
} from "@/lib/supabase/service";

const PG_UNIQUE_VIOLATION = "23505";
export const CHECKOUT_COOKIE = "od_checkout";

export type PaymentKind = "club" | "day" | "weekend";

export type ConfirmedPayment = {
  applied: boolean;
  kinds: PaymentKind[];
};

function isPaymentKind(value: string | undefined): value is PaymentKind {
  return value === "club" || value === "day" || value === "weekend";
}

/** Claims a paid checkout once, then opens the club month or tournament days. */
export async function fulfillPaidCheckout(checkout: {
  id: string;
  metadata: Record<string, string>;
  paymentIds?: string[];
}): Promise<PaymentKind | null> {
  const facilityId = checkout.metadata.facility_id;
  const kind = checkout.metadata.kind;
  if (!facilityId || !isPaymentKind(kind)) return null;

  const supabase = createServiceClient();
  const claimIds = [checkout.id, ...(checkout.paymentIds ?? [])].filter(
    (id) => id.length > 0,
  );
  const { data: existing, error: existingError } = await supabase
    .from("paymongo_payments")
    .select("checkout_id")
    .in("checkout_id", claimIds);
  if (existingError) {
    console.error("[billing] payment lookup failed", existingError.code);
    throw new Error("payment lookup failed");
  }
  if (existing && existing.length > 0) return kind;
  const { error: claimed } = await supabase.from("paymongo_payments").insert({
    checkout_id: checkout.id,
    facility_id: facilityId,
    kind,
    amount_centavos: catalogCentavos(kind),
  });
  if (claimed?.code === PG_UNIQUE_VIOLATION) return kind;
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
      return kind;
    }

    const pass = passFromCheckoutMetadata(checkout.metadata);
    if (!pass) {
      console.error("[billing] pass metadata rejected");
      return null;
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
    return kind;
  } catch (error) {
    await supabase
      .from("paymongo_payments")
      .delete()
      .eq("checkout_id", checkout.id);
    throw error;
  }
}

export async function rememberCheckout(id: string): Promise<void> {
  const jar = await cookies();
  jar.set(CHECKOUT_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
    secure: process.env.NODE_ENV === "production",
  });
}

/**
 * Applies paid checkouts for this club when the browser returns from PayMongo.
 * Localhost never receives the webhook, so the return has to confirm the payment.
 */
export async function confirmReturnedCheckout(
  facilityId: string,
): Promise<ConfirmedPayment> {
  if (!isServiceRoleConfigured()) return { applied: false, kinds: [] };

  const jar = await cookies();
  const cookieId = jar.get(CHECKOUT_COOKIE)?.value ?? "";
  const remembered = cookieId ? await retrievePaidCheckout(cookieId) : null;
  const payments = remembered ? [] : await listRecentPaidPayments();
  const candidates: {
    id: string;
    metadata: Record<string, string>;
    paymentIds: string[];
  }[] = [];
  if (remembered) {
    candidates.push({
      id: remembered.id,
      metadata: remembered.metadata,
      paymentIds: [],
    });
  }
  for (const payment of payments) {
    const kind = paymentPlanForFacility(payment, facilityId);
    if (!kind || payment.amount !== catalogCentavos(kind)) continue;
    candidates.push({
      id: payment.id,
      metadata: {
        ...payment.metadata,
        facility_id: facilityId,
        kind,
        ...(payment.metadata.starts_on
          ? { starts_on: payment.metadata.starts_on }
          : {}),
      },
      paymentIds: [payment.id],
    });
  }

  if (candidates.length === 0 && payments.length > 0) {
    console.error("[billing] paid payments did not match this club");
  }
  const seen = new Set<string>();
  const kinds: PaymentKind[] = [];
  for (const checkout of candidates) {
    if (seen.has(checkout.id)) continue;
    seen.add(checkout.id);
    if (checkout.metadata.facility_id !== facilityId) continue;
    try {
      const kind = await fulfillPaidCheckout(checkout);
      if (kind) kinds.push(kind);
    } catch (error) {
      console.error(
        "[billing] return confirm failed",
        error instanceof Error ? error.name : "error",
      );
    }
  }

  return { applied: kinds.length > 0, kinds };
}
