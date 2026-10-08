import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loadDirectorTournament } from "@/lib/tournament-server";

export const metadata: Metadata = {
  title: "Tournament scoreboard",
  description: "Live courts, category standings, and brackets.",
};

export default async function TournamentBoardPage() {
  const tournament = await loadDirectorTournament();
  if (tournament.status === "ready") {
    redirect(`/tournament/board/${tournament.publicToken}`);
  }

  return (
    <main className="mx-auto max-w-lg space-y-4 px-6 py-16">
      <h1 className="font-[family-name:var(--font-display)] text-4xl">
        Scoreboard
      </h1>
      <p className="text-[var(--muted)]">
        Open Scoreboard from the tournament desk. That link stays up to date on
        a gym TV without signing in there.
      </p>
      <Link href="/tournament" className="text-[var(--accent)] underline">
        Tournament desk
      </Link>
    </main>
  );
}
