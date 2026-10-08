import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TournamentBoard } from "@/components/tournament/tournament-board";
import { loadTournamentByToken } from "@/lib/tournament-server";

export const metadata: Metadata = {
  title: "Tournament scoreboard",
  description: "Live courts, category standings, and brackets.",
};

export default async function TournamentBoardTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tournament = await loadTournamentByToken(token);
  if (!tournament) notFound();

  return (
    <TournamentBoard
      tournamentId={tournament.id}
      initialEvent={tournament.event}
    />
  );
}
