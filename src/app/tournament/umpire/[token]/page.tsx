import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TournamentUmpire } from "@/components/tournament/tournament-umpire";
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

  return (
    <TournamentUmpire
      tournamentId={tournament.id}
      umpireToken={token}
      initialEvent={tournament.event}
    />
  );
}
