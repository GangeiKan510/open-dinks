import { notFound, redirect } from "next/navigation";
import { LiveSessionApp } from "@/components/session/live-session-app";
import { siteUrl } from "@/lib/env";
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
