"use server";

import { redirect } from "next/navigation";
import { loadAccountVenue } from "@/lib/account-venue";
import { loadFeatureAccess } from "@/lib/billing-server";
import {
  CLUB_PRICE_CENTAVOS,
  localDateISO,
  TOURNAMENT_DAY_CENTAVOS,
  TOURNAMENT_WEEKEND_CENTAVOS,
  tournamentPassWindow,
  type PassKind,
} from "@/lib/entitlements";
import { rememberCheckout } from "@/lib/billing-fulfill";
import { siteUrl } from "@/lib/env";
import { isPublicBooker } from "@/lib/host-access";
import { createPaymongoCheckout, isPaymongoConfigured } from "@/lib/paymongo";
import { createClient } from "@/lib/supabase/server";

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

  const kindValue = String(formData.get("kind") ?? "");
  const kind: PassKind | null =
    kindValue === "day" || kindValue === "weekend" ? kindValue : null;
  const startsOn = String(formData.get("startsOn") ?? "");
  const window = kind ? tournamentPassWindow(kind, startsOn) : null;
  if (!kind || !window) notice("date");

  const today = localDateISO(host.venue.timezone, new Date());
  if (startsOn < today) notice("past");

  const access = await loadFeatureAccess(
    host.supabase,
    host.venue.facilityId,
    host.venue.timezone,
  );
  if (!access.schemaReady) notice("checkout");

  const amount =
    kind === "day" ? TOURNAMENT_DAY_CENTAVOS : TOURNAMENT_WEEKEND_CENTAVOS;
  const label =
    kind === "day" ? "Picklrz tournament day" : "Picklrz tournament 4-day pass";

  const url = await checkoutUrl({
    facilityId: host.venue.facilityId,
    name: label,
    amount,
    description:
      kind === "day"
        ? `Tournament day ${window.startsOn}`
        : `Tournament days ${window.startsOn} to ${window.endsOn}`,
    metadata: { kind, starts_on: window.startsOn },
  });
  if (!url) notice("checkout");
  redirect(url);
}
