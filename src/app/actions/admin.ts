"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ADMIN_ERROR_MESSAGES } from "@/lib/admin-messages";
import {
  CATALOG_ERROR_MESSAGES,
  parsePlanPricePhp,
} from "@/lib/platform-catalog";
import { DISCOUNT_ADMIN_MESSAGES, parseDiscountDraft } from "@/lib/discounts";
import { fulfillPaidCheckout } from "@/lib/billing-fulfill";
import { countOperators, requireOperator } from "@/lib/admin-server";
import { mapAuthError } from "@/lib/auth-errors";
import { isLocalSite } from "@/lib/env";
import {
  canCreateFirstOperator,
  parseOperatorDraft,
} from "@/lib/operator-access";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/service";

type CreateResult = { ok: true } | { ok: false; error: string };

async function createOperatorAccount(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<CreateResult> {
  if (!isServiceRoleConfigured()) {
    return { ok: false, error: ADMIN_ERROR_MESSAGES.unconfigured };
  }
  const service = createServiceClient();
  const created = await service.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { display_name: input.displayName },
  });
  if (created.error || !created.data.user) {
    console.error(
      "[admin] create user failed",
      created.error?.code ?? created.error?.status,
    );
    return {
      ok: false,
      error: mapAuthError(created.error, "SIGN_UP_FAILED"),
    };
  }

  const userId = created.data.user.id;
  const { error: profileError } = await service.from("profiles").upsert({
    id: userId,
    display_name: input.displayName,
  });
  if (profileError) {
    console.error("[admin] profile failed", profileError.code);
    await service.auth.admin.deleteUser(userId);
    return { ok: false, error: ADMIN_ERROR_MESSAGES.createFailed };
  }

  const { error: rosterError } = await service
    .from("platform_admins")
    .insert({ user_id: userId });
  if (rosterError) {
    console.error("[admin] roster insert failed", rosterError.code);
    await service.auth.admin.deleteUser(userId);
    return { ok: false, error: ADMIN_ERROR_MESSAGES.createFailed };
  }

  return { ok: true };
}

export async function createFirstOperatorAction(
  formData: FormData,
): Promise<CreateResult> {
  const draft = parseOperatorDraft({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });
  if (!draft.ok) return draft;
  if (!isServiceRoleConfigured()) {
    return { ok: false, error: ADMIN_ERROR_MESSAGES.unconfigured };
  }

  const service = createServiceClient();
  const { count, error } = await service
    .from("platform_admins")
    .select("user_id", { count: "exact", head: true });
  if (error) {
    if (isMissingSchemaError(error)) {
      return { ok: false, error: ADMIN_ERROR_MESSAGES.missingSchema };
    }
    console.error("[admin] roster count failed", error.code);
    return { ok: false, error: ADMIN_ERROR_MESSAGES.createFailed };
  }

  const allowed = canCreateFirstOperator({
    existing: count ?? 0,
    local: isLocalSite(),
    setupKey: String(formData.get("setupKey") ?? ""),
    configuredKey: process.env.PLATFORM_ADMIN_SETUP_KEY,
  });
  if (!allowed) {
    return {
      ok: false,
      error:
        (count ?? 0) > 0
          ? ADMIN_ERROR_MESSAGES.alreadyClaimed
          : ADMIN_ERROR_MESSAGES.setupKey,
    };
  }

  const result = await createOperatorAccount(draft);
  if (result.ok) revalidatePath("/admin/login");
  return result;
}

export async function createOperatorAction(
  formData: FormData,
): Promise<CreateResult> {
  const gate = await requireOperator();
  if (!gate.ok) return { ok: false, error: ADMIN_ERROR_MESSAGES.forbidden };
  const draft = parseOperatorDraft({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });
  if (!draft.ok) return draft;
  const existing = await countOperators();
  if (existing == null) {
    return { ok: false, error: ADMIN_ERROR_MESSAGES.createFailed };
  }
  const result = await createOperatorAccount(draft);
  if (result.ok) revalidatePath("/admin/operators");
  return result;
}

export async function toggleFeaturedFeedbackAction(
  formData: FormData,
): Promise<void> {
  const gate = await requireOperator();
  if (!gate.ok) redirect(gate.reason === "signed-out" ? "/admin/login" : "/");
  const id = String(formData.get("id") ?? "");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    redirect("/admin/feedback");
  }
  if (!isServiceRoleConfigured()) redirect("/admin/feedback");

  const service = createServiceClient();
  const { data, error } = await service
    .from("feedback")
    .select("featured")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("[admin] feature read failed", error.code);
    redirect("/admin/feedback?notice=feature");
  }

  const { error: updateError } = await service
    .from("feedback")
    .update({ featured: !data.featured })
    .eq("id", id);
  if (updateError) {
    console.error("[admin] feature update failed", updateError.code);
    redirect("/admin/feedback?notice=feature");
  }
  revalidatePath("/admin/feedback");
  revalidatePath("/");
  redirect("/admin/feedback");
}

const DISCOUNT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createDiscountCodeAction(
  formData: FormData,
): Promise<CreateResult> {
  const gate = await requireOperator();
  if (!gate.ok) return { ok: false, error: ADMIN_ERROR_MESSAGES.forbidden };
  const draft = parseDiscountDraft({
    code: formData.get("code"),
    appliesTo: formData.get("appliesTo"),
    mode: formData.get("mode"),
    value: formData.get("value"),
    expiresOn: formData.get("expiresOn"),
    maxRedemptions: formData.get("maxRedemptions"),
  });
  if (!draft.ok) return draft;
  if (!isServiceRoleConfigured()) {
    return { ok: false, error: ADMIN_ERROR_MESSAGES.unconfigured };
  }

  const service = createServiceClient();
  const { error } = await service.from("discount_codes").insert({
    code: draft.draft.code,
    applies_to: draft.draft.appliesTo,
    percent_off: draft.draft.percentOff,
    amount_off_centavos: draft.draft.amountOffCentavos,
    expires_on: draft.draft.expiresOn,
    max_redemptions: draft.draft.maxRedemptions,
  });
  if (error) {
    if (isMissingSchemaError(error)) {
      return { ok: false, error: ADMIN_ERROR_MESSAGES.missingSchema };
    }
    if (error.code === "23505") {
      return { ok: false, error: DISCOUNT_ADMIN_MESSAGES.exists };
    }
    console.error("[admin] discount create failed", error.code);
    return { ok: false, error: DISCOUNT_ADMIN_MESSAGES.save };
  }
  revalidatePath("/admin/codes");
  return { ok: true };
}

export async function toggleDiscountCodeAction(
  formData: FormData,
): Promise<void> {
  const gate = await requireOperator();
  if (!gate.ok) {
    redirect(gate.reason === "signed-out" ? "/admin/login" : "/dashboard");
  }
  const id = String(formData.get("id") ?? "");
  if (!DISCOUNT_ID.test(id) || !isServiceRoleConfigured()) {
    redirect("/admin/codes");
  }
  const service = createServiceClient();
  const { error } = await service
    .from("discount_codes")
    .update({ active: formData.get("active") === "true" })
    .eq("id", id);
  if (error) console.error("[admin] discount toggle failed", error.code);
  revalidatePath("/admin/codes");
  redirect("/admin/codes");
}

const PROOF_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function pendingProof(id: string) {
  const gate = await requireOperator();
  if (!gate.ok) {
    redirect(gate.reason === "signed-out" ? "/admin/login" : "/dashboard");
  }
  if (!PROOF_ID.test(id) || !isServiceRoleConfigured()) return null;
  const service = createServiceClient();
  const { data, error } = await service
    .from("manual_payment_proofs")
    .select(
      "id, facility_id, kind, amount_centavos, discount_code, dates, status",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data || data.status !== "pending") {
    if (error) console.error("[admin] receipt load failed", error.code);
    return null;
  }
  return { gate, service, proof: data };
}

export async function approveManualPaymentAction(
  formData: FormData,
): Promise<void> {
  const loaded = await pendingProof(String(formData.get("id") ?? ""));
  if (!loaded) redirect("/admin/payments?review=failed");
  const { gate, service, proof } = loaded;
  if (proof.kind !== "club" && proof.kind !== "day") {
    redirect("/admin/payments?review=failed");
  }

  try {
    const applied = await fulfillPaidCheckout({
      id: `manual_${proof.id}`,
      metadata: {
        facility_id: proof.facility_id,
        kind: proof.kind,
        ...(proof.dates ? { dates: proof.dates } : {}),
        ...(proof.discount_code
          ? {
              discount_code: proof.discount_code,
              quoted_centavos: String(proof.amount_centavos),
            }
          : {}),
      },
    });
    if (!applied) redirect("/admin/payments?review=failed");
  } catch (error) {
    console.error(
      "[admin] receipt approve failed",
      error instanceof Error ? error.name : "error",
    );
    redirect("/admin/payments?review=failed");
  }

  const { error } = await service
    .from("manual_payment_proofs")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: gate.userId,
    })
    .eq("id", proof.id)
    .eq("status", "pending");
  if (error) console.error("[admin] receipt status failed", error.code);
  revalidatePath("/admin/payments");
  revalidatePath("/admin/sales");
  revalidatePath("/dashboard");
  redirect("/admin/payments?review=approved");
}

export async function rejectManualPaymentAction(
  formData: FormData,
): Promise<void> {
  const loaded = await pendingProof(String(formData.get("id") ?? ""));
  if (!loaded) redirect("/admin/payments?review=failed");
  const note = String(formData.get("note") ?? "")
    .trim()
    .slice(0, 240);
  const { error } = await loaded.service
    .from("manual_payment_proofs")
    .update({
      status: "rejected",
      review_note: note || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: loaded.gate.userId,
    })
    .eq("id", loaded.proof.id)
    .eq("status", "pending");
  if (error) {
    console.error("[admin] receipt reject failed", error.code);
    redirect("/admin/payments?review=failed");
  }
  revalidatePath("/admin/payments");
  revalidatePath("/dashboard");
  redirect("/admin/payments?review=rejected");
}

export async function savePlanCatalogAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireOperator();
  if (!gate.ok) return { ok: false, error: ADMIN_ERROR_MESSAGES.forbidden };
  const clubMonthlyPhp = parsePlanPricePhp(formData.get("clubMonthlyPhp"));
  const tournamentDayPhp = parsePlanPricePhp(formData.get("tournamentDayPhp"));
  if (clubMonthlyPhp == null || tournamentDayPhp == null) {
    return { ok: false, error: CATALOG_ERROR_MESSAGES.price };
  }
  if (!isServiceRoleConfigured()) {
    return { ok: false, error: ADMIN_ERROR_MESSAGES.unconfigured };
  }
  const service = createServiceClient();
  const { error } = await service.from("platform_settings").upsert(
    {
      id: true,
      club_monthly_php: clubMonthlyPhp,
      tournament_day_php: tournamentDayPhp,
      show_open_play: formData.get("showOpenPlay") === "1",
      show_booking: formData.get("showBooking") === "1",
      show_tournament: formData.get("showTournament") === "1",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) {
    console.error("[admin] catalog save failed", error.code);
    if (isMissingSchemaError(error)) {
      return { ok: false, error: ADMIN_ERROR_MESSAGES.missingSchema };
    }
    return { ok: false, error: CATALOG_ERROR_MESSAGES.save };
  }
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/admin/plans");
  revalidatePath("/tournament");
  return { ok: true };
}
