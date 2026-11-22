import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TournamentUmpire } from "@/components/tournament/tournament-umpire";
import { createClient } from "@/lib/supabase/server";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { loadTournamentByUmpireToken } from "@/lib/tournament-server";

export const metadata: Metadata = {
  title: "Umpire",
  description: "Call the match on your court.",
};

export default async function TournamentUmpirePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tournament = await loadTournamentByUmpireToken(token);
  if (!tournament) notFound();

  const supabase = await createClient();
  const { data: deskOpen, error: deskError } = await supabase.rpc(
    "tournament_desk_open",
    { p_token: token },
  );
  if (!deskError && deskOpen === false) {
    return (
      <main className="mx-auto max-w-lg space-y-3 px-6 py-16">
        <h1 className="font-[family-name:var(--font-display)] text-4xl">
          Court desk closed
        </h1>
        <p className="text-[var(--muted)]">
          This tournament day is not active. The scoreboard stays up. Scoring
          opens again when the club has a tournament day that covers today.
        </p>
      </main>
    );
  }
  if (deskError && !isMissingSchemaError(deskError)) {
    console.error("[tournament] desk check failed", deskError.code);
  }

  return (
    <TournamentUmpire
      tournamentId={tournament.id}
      umpireToken={token}
      initialEvent={tournament.event}
    />
  );
}
