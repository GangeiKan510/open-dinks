import { notFound } from "next/navigation";
import { LiveSessionApp } from "@/components/session/live-session-app";
import { siteUrl } from "@/lib/env";
import { loadSessionBundle } from "@/lib/session-bundle";

export default async function BoardSessionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const bundle = await loadSessionBundle(token);
  if (!bundle) notFound();

  const base = siteUrl();
  return (
    <LiveSessionApp
      token={token}
      initial={bundle}
      mode="board"
      playerUrl={`${base}/s/${token}`}
      boardUrl={`${base}/s/${token}/board`}
    />
  );
}
