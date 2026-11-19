import {
  resolveFeatureAccess,
  type ClubStatus,
  type FeatureAccess,
} from "@/lib/entitlements";
import {
  isMissingSchemaError,
  type SupabaseErrorLike,
} from "@/lib/supabase/errors";
import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type LoadedFeatureAccess = FeatureAccess & {
  /** False until the billing migration is applied. Features stay open then. */
  schemaReady: boolean;
};

const OPEN_ACCESS: LoadedFeatureAccess = {
  openPlay: true,
  booking: true,
  tournament: true,
  clubPaid: true,
  phase: "active",
  trialDaysLeft: 0,
  awaitingPlanChoice: false,
  clubPeriodEnd: null,
  tournamentStartsOn: null,
  tournamentThrough: null,
  tournamentGrace: false,
  schemaReady: false,
};

function isMissingChoiceColumn(
  error: SupabaseErrorLike | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return (error.message ?? "").toLowerCase().includes("choice_made_at");
}

function isClubStatus(value: string): value is ClubStatus {
  return (
    value === "none" ||
    value === "active" ||
    value === "past_due" ||
    value === "canceled"
  );
}

export async function loadFeatureAccess(
  supabase: ServerClient,
  facilityId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<LoadedFeatureAccess> {
  const passesResult = await supabase
    .from("tournament_passes")
    .select("starts_on, ends_on")
    .eq("facility_id", facilityId);
  let choiceColumnReady = true;
  let billingResult = await supabase
    .from("facility_billing")
    .select("trial_ends_at, club_status, club_period_end, choice_made_at")
    .eq("facility_id", facilityId)
    .maybeSingle();
  if (isMissingChoiceColumn(billingResult.error)) {
    choiceColumnReady = false;
    billingResult = await supabase
      .from("facility_billing")
      .select("trial_ends_at, club_status, club_period_end")
      .eq("facility_id", facilityId)
      .maybeSingle();
  }

  if (
    isMissingSchemaError(billingResult.error) ||
    isMissingSchemaError(passesResult.error)
  ) {
    return OPEN_ACCESS;
  }

  if (billingResult.error) {
    console.error("[billing] load failed", billingResult.error.code);
  }
  if (passesResult.error) {
    console.error("[billing] passes load failed", passesResult.error.code);
  }

  const billing = billingResult.data;
  const clubStatus = isClubStatus(billing?.club_status ?? "")
    ? billing!.club_status
    : "none";
  const access = resolveFeatureAccess({
    now,
    timeZone,
    trialEndsAt: billing?.trial_ends_at ?? null,
    clubStatus,
    clubPeriodEnd: billing?.club_period_end ?? null,
    choiceMade:
      !choiceColumnReady ||
      billingResult.error != null ||
      billing?.choice_made_at != null,
    passes: (passesResult.data ?? []).map((pass) => ({
      startsOn: pass.starts_on,
      endsOn: pass.ends_on,
    })),
  });

  return { ...access, schemaReady: true };
}
