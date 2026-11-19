import { normalizeDiscountCode, type DiscountOffer } from "@/lib/discounts";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/service";

const PG_UNIQUE_VIOLATION = "23505";

type CodeRow = {
  id: string;
  code: string;
  applies_to: DiscountOffer["appliesTo"];
  percent_off: number | null;
  amount_off_centavos: number | null;
  active: boolean;
  expires_on: string | null;
  max_redemptions: number | null;
};

function toOffer(row: CodeRow, redemptionCount: number): DiscountOffer {
  return {
    id: row.id,
    code: row.code,
    appliesTo: row.applies_to,
    percentOff: row.percent_off,
    amountOffCentavos: row.amount_off_centavos,
    active: row.active,
    expiresOn: row.expires_on,
    maxRedemptions: row.max_redemptions,
    redemptionCount,
  };
}

async function redemptionCount(
  supabase: ReturnType<typeof createServiceClient>,
  codeId: string,
): Promise<number | null> {
  const { count, error } = await supabase
    .from("discount_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("code_id", codeId);
  if (error) {
    console.error("[billing] discount uses failed", error.code);
    return null;
  }
  return count ?? 0;
}

export async function loadDiscountOffer(
  code: string,
): Promise<
  | { status: "found"; offer: DiscountOffer }
  | { status: "missing" }
  | { status: "unavailable" }
> {
  const normalized = normalizeDiscountCode(code);
  if (!normalized || !isServiceRoleConfigured())
    return { status: "unavailable" };
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("discount_codes")
    .select(
      "id, code, applies_to, percent_off, amount_off_centavos, active, expires_on, max_redemptions",
    )
    .eq("code", normalized)
    .maybeSingle();
  if (error) {
    console.error("[billing] discount lookup failed", error.code);
    return { status: "unavailable" };
  }
  if (!data) return { status: "missing" };
  const uses = await redemptionCount(supabase, data.id);
  if (uses == null) return { status: "unavailable" };
  return { status: "found", offer: toOffer(data, uses) };
}

export async function listDiscountOffers(): Promise<
  { ok: true; offers: DiscountOffer[] } | { ok: false; missing: boolean }
> {
  if (!isServiceRoleConfigured()) return { ok: false, missing: false };
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("discount_codes")
    .select(
      "id, code, applies_to, percent_off, amount_off_centavos, active, expires_on, max_redemptions",
    )
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[billing] discount list failed", error.code);
    return { ok: false, missing: isMissingSchemaError(error) };
  }
  const offers: DiscountOffer[] = [];
  for (const row of data ?? []) {
    const uses = await redemptionCount(supabase, row.id);
    offers.push(toOffer(row, uses ?? 0));
  }
  return { ok: true, offers };
}

/** A paid checkout consumes one use. A repeated confirmation does not. */
export async function recordDiscountRedemption(input: {
  code: string;
  facilityId: string;
  checkoutId: string;
}): Promise<void> {
  const normalized = normalizeDiscountCode(input.code);
  if (!normalized || !isServiceRoleConfigured()) return;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("discount_codes")
    .select("id")
    .eq("code", normalized)
    .maybeSingle();
  if (error || !data) {
    console.error("[billing] discount redemption lookup failed", error?.code);
    return;
  }
  const { error: insertError } = await supabase
    .from("discount_redemptions")
    .insert({
      code_id: data.id,
      facility_id: input.facilityId,
      checkout_id: input.checkoutId,
    });
  if (insertError && insertError.code !== PG_UNIQUE_VIOLATION) {
    console.error("[billing] discount redemption failed", insertError.code);
  }
}
