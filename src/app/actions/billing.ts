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
    .select("choice_made_at, trial_ends_at")
    .eq("facility_id", host.venue.facilityId)
    .maybeSingle();
  if (loadError) {
    console.error("[billing] trial load failed", loadError.code);
    notice("trial");
  }
  if (billing?.choice_made_at || billing?.trial_ends_at) {
    redirect("/dashboard");
  }

  const row = {
    facility_id: host.venue.facilityId,
    trial_ends_at: new Date(now.getTime() + TRIAL_MS).toISOString(),
    choice_made_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
  const { error } = billing
    ? await supabase
        .from("facility_billing")
        .update(row)
        .eq("facility_id", host.venue.facilityId)
        .is("choice_made_at", null)
        .is("trial_ends_at", null)
    : await supabase.from("facility_billing").insert(row);
  if (error) {
    console.error("[billing] trial start failed", error.code);
    notice("trial");
  }
  redirect("/dashboard");
}

export async function startClubCheckoutAction(): Promise<void> {
  const host = await hostFacility();
  if (!host) notice("checkout");
  if (!isPaymongoConfigured()) notice("unconfigured");

  const url = await checkoutUrl({
    facilityId: host.venue.facilityId,
    name: "Picklrz Club",
    amount: CLUB_PRICE_CENTAVOS,
    description: "One month of open play and booking",
    metadata: { kind: "club" },
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

  const amount = tournamentDatesPriceCentavos(dates);
  if (amount == null) notice("date");
  const label =
    dates.length === 1
      ? "Picklrz tournament day"
      : `Picklrz tournament ${dates.length} days`;

  const url = await checkoutUrl({
    facilityId: host.venue.facilityId,
    name: label,
    amount,
    description: `Tournament days ${dates.join(", ")}`,
    metadata: { kind: "day", dates: dates.join(",") },
  });
  if (!url) notice("checkout");
  redirect(url);
}
