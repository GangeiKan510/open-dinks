"use server";

import { redirect } from "next/navigation";
import { loadAccountVenue } from "@/lib/account-venue";
import { loadFeatureAccess } from "@/lib/billing-server";
import {
  CLUB_PRICE_CENTAVOS,
  localDateISO,
  TRIAL_DAYS,
  parseTournamentDates,
  tournamentDatesPriceCentavos,
} from "@/lib/entitlements";
import { rememberCheckout } from "@/lib/billing-fulfill";
import { BILLING_ERROR_MESSAGES } from "@/lib/billing-messages";
import { loadDiscountOffer } from "@/lib/discount-codes";
import {
  checkoutDescription,
  discountSummary,
  normalizeDiscountCode,
  priceWithDiscount,
  type DiscountProduct,
} from "@/lib/discounts";
import { siteUrl } from "@/lib/env";
import { isPublicBooker } from "@/lib/host-access";
import { createPaymongoCheckout, isPaymongoConfigured } from "@/lib/paymongo";
import { createClient } from "@/lib/supabase/server";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/service";

function notice(code: string): never {
  redirect(`/dashboard?billing=${code}`);
}

async function hostFacility() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || isPublicBooker(user)) return null;
  const venue = await loadAccountVenue(user.id, supabase);
  if (!venue) return null;
  return { supabase, user, venue };
}

async function priceCheckout(input: {
  product: DiscountProduct;
  listCentavos: number;
  today: string;
  codeRaw: string;
  baseDescription: string;
}): Promise<
  | {
      ok: true;
      amount: number;
      description: string;
      extra: Record<string, string>;
      summary: string | null;
    }
  | { ok: false; notice: "code" | "checkout" }
> {
  const code = normalizeDiscountCode(input.codeRaw);
  if (input.codeRaw.trim() && !code) return { ok: false, notice: "code" };
  if (!code) {
    return {
      ok: true,
      amount: input.listCentavos,
      description: input.baseDescription,
      extra: {},
      summary: null,
    };
  }

  const loaded = await loadDiscountOffer(code);
  if (loaded.status !== "found") return { ok: false, notice: "code" };
  const quote = priceWithDiscount({
    product: input.product,
    listCentavos: input.listCentavos,
    today: input.today,
    offer: loaded.offer,
  });
  if (!quote) return { ok: false, notice: "code" };
  return {
    ok: true,
    amount: quote.dueCentavos,
    description: checkoutDescription({
      base: input.baseDescription,
      listCentavos: input.listCentavos,
      dueCentavos: quote.dueCentavos,
      code,
    }),
    extra: {
      discount_code: code,
      quoted_centavos: String(quote.dueCentavos),
    },
    summary: discountSummary({
      listCentavos: input.listCentavos,
      dueCentavos: quote.dueCentavos,
      code,
    }),
  };
}

export async function previewDiscountAction(input: {
  product: DiscountProduct;
  dates: string;
  code: string;
}): Promise<{ ok: true; summary: string } | { ok: false; message: string }> {
  const host = await hostFacility();
  if (!host) return { ok: false, message: BILLING_ERROR_MESSAGES.signIn };
  if (input.product !== "club" && input.product !== "day") {
    return { ok: false, message: BILLING_ERROR_MESSAGES.code };
  }

  let listCentavos = CLUB_PRICE_CENTAVOS;
  if (input.product === "day") {
    const dates = parseTournamentDates(input.dates);
    const price = dates ? tournamentDatesPriceCentavos(dates) : null;
    if (price == null) {
      return { ok: false, message: BILLING_ERROR_MESSAGES.date };
    }
    listCentavos = price;
  }

  const priced = await priceCheckout({
    product: input.product,
    listCentavos,
    today: localDateISO(host.venue.timezone, new Date()),
    codeRaw: input.code,
    baseDescription: "",
  });
  if (!priced.ok || !priced.summary) {
    return { ok: false, message: BILLING_ERROR_MESSAGES.code };
  }
  return { ok: true, summary: priced.summary };
}

async function checkoutUrl(input: {
  facilityId: string;
  name: string;
  amount: number;
  description: string;
  metadata: Record<string, string>;
}): Promise<string | null> {
  try {
    const checkout = await createPaymongoCheckout({
      line: {
        name: input.name,
        amount: input.amount,
        description: input.description,
      },
      successUrl: `${siteUrl()}/dashboard?billing=success`,
      cancelUrl: `${siteUrl()}/dashboard?billing=cancel`,
      referenceNumber: `${input.metadata.kind}-${input.facilityId}`.slice(
        0,
        100,
      ),
      metadata: { facility_id: input.facilityId, ...input.metadata },
    });
    await rememberCheckout(checkout.id);
    return checkout.url;
  } catch (error) {
    console.error(
      "[billing] checkout failed",
      error instanceof Error ? error.name : "error",
    );
    return null;
  }
}

const TRIAL_MS = TRIAL_DAYS * 86_400_000;

export async function startTrialAction(): Promise<void> {
  const host = await hostFacility();
  if (!host) notice("checkout");
  if (!isServiceRoleConfigured()) notice("trial");

  const now = new Date();
  const supabase = createServiceClient();
  const { data: billing, error: loadError } = await supabase
    .from("facility_billing")
    .select("choice_made_at, trial_ends_at, club_period_end")
    .eq("facility_id", host.venue.facilityId)
    .maybeSingle();
  if (loadError) {
    console.error("[billing] trial load failed", loadError.code);
    notice("trial");
  }
  if (billing?.trial_ends_at || billing?.club_period_end) {
    redirect("/dashboard");
  }

  const row = {
    facility_id: host.venue.facilityId,
    trial_ends_at: new Date(now.getTime() + TRIAL_MS).toISOString(),
    choice_made_at: billing?.choice_made_at ?? now.toISOString(),
    updated_at: now.toISOString(),
  };
  const { error } = billing
    ? await supabase
        .from("facility_billing")
        .update(row)
        .eq("facility_id", host.venue.facilityId)
        .is("trial_ends_at", null)
        .is("club_period_end", null)
    : await supabase.from("facility_billing").insert(row);
  if (error) {
    console.error("[billing] trial start failed", error.code);
    notice("trial");
  }
  redirect("/dashboard");
}

export async function startClubCheckoutAction(
  formData: FormData,
): Promise<void> {
  const host = await hostFacility();
  if (!host) notice("checkout");
  if (!isPaymongoConfigured()) notice("unconfigured");

  const priced = await priceCheckout({
    product: "club",
    listCentavos: CLUB_PRICE_CENTAVOS,
    today: localDateISO(host.venue.timezone, new Date()),
    codeRaw: String(formData.get("discount_code") ?? ""),
    baseDescription: "One month of open play and booking",
  });
  if (!priced.ok) notice(priced.notice);

  const url = await checkoutUrl({
    facilityId: host.venue.facilityId,
    name: "Picklrz Club",
    amount: priced.amount,
    description: priced.description,
    metadata: { kind: "club", ...priced.extra },
  });
  if (!url) notice("checkout");
  redirect(url);
}

export async function startTournamentPassAction(
  formData: FormData,
): Promise<void> {
  const host = await hostFacility();
  if (!host) notice("checkout");
  if (!isPaymongoConfigured()) notice("unconfigured");

  const dates = parseTournamentDates(String(formData.get("dates") ?? ""));
  if (!dates) notice("date");

  const today = localDateISO(host.venue.timezone, new Date());
  if (dates.some((date) => date < today)) notice("past");

  const access = await loadFeatureAccess(
    host.supabase,
    host.venue.facilityId,
    host.venue.timezone,
  );
  if (!access.schemaReady) notice("checkout");
  if (dates.some((date) => access.ownedTournamentDates.includes(date))) {
    notice("owned");
  }

  const amount = tournamentDatesPriceCentavos(dates);
  if (amount == null) notice("date");
  const priced = await priceCheckout({
    product: "day",
    listCentavos: amount,
    today,
    codeRaw: String(formData.get("discount_code") ?? ""),
    baseDescription: `Tournament days ${dates.join(", ")}`,
  });
  if (!priced.ok) notice(priced.notice);
  const label =
    dates.length === 1
      ? "Picklrz tournament day"
      : `Picklrz tournament ${dates.length} days`;

  const url = await checkoutUrl({
    facilityId: host.venue.facilityId,
    name: label,
    amount: priced.amount,
    description: priced.description,
    metadata: { kind: "day", dates: dates.join(","), ...priced.extra },
  });
  if (!url) notice("checkout");
  redirect(url);
}
