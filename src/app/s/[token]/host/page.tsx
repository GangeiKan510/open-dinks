import { notFound, redirect } from "next/navigation";
import { LiveSessionApp } from "@/components/session/live-session-app";
import { loadAccountVenue } from "@/lib/account-venue";
import { loadFeatureAccess } from "@/lib/billing-server";
import { siteUrl } from "@/lib/env";
import { canManageOpenPlay } from "@/lib/open-play";
import { loadSessionBundle } from "@/lib/session-bundle";
import { createClient } from "@/lib/supabase/server";

export default async function HostSessionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const bundle = await loadSessionBundle(token);
  if (!bundle) notFound();

  const venue = await loadAccountVenue(user.id, supabase);
  if (!venue || venue.id !== bundle.session.venue_id) redirect("/");

  if (bundle.session.status === "live") {
    const access = await loadFeatureAccess(
      supabase,
      venue.facilityId,
      venue.timezone,
    );
    if (!canManageOpenPlay(access)) redirect("/dashboard");
  }

  const base = siteUrl();
  return (
    <LiveSessionApp
      token={token}
      initial={bundle}
      mode="host"
      playerUrl={`${base}/s/${token}`}
      boardUrl={`${base}/s/${token}/board`}
    />
  );
}
