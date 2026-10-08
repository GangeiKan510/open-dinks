import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TournamentDirector } from "@/components/tournament/tournament-director";
import { Button } from "@/components/ui/button";
import { loadDirectorTournament } from "@/lib/tournament-server";

export const metadata: Metadata = {
  title: "Tournament",
  description:
    "Run a pickleball tournament with categories playing at once, shared courts, standings, and brackets.",
};

export default async function TournamentPage() {
  const tournament = await loadDirectorTournament();
  if (tournament.status === "signed-out") {
    redirect("/login?next=/tournament");
  }
  if (tournament.status === "unconfigured") {
    return <TournamentUnavailable />;
  }
  if (tournament.status === "missing-schema") {
    return <TournamentUnavailable missingSchema />;
  }
  if (tournament.status === "error") {
    return <TournamentUnavailable failed />;
  }

  return (
    <TournamentDirector
      tournamentId={tournament.id}
      publicToken={tournament.publicToken}
      umpireToken={tournament.umpireToken}
      initialEvent={tournament.event}
    />
  );
}

function TournamentUnavailable({
  missingSchema = false,
  failed = false,
}: {
  missingSchema?: boolean;
  failed?: boolean;
}) {
  return (
    <main className="mx-auto max-w-lg space-y-4 px-6 py-16">
      <h1 className="font-[family-name:var(--font-display)] text-4xl">
        {failed ? "Could not open the tournament" : "Connect Supabase"}
      </h1>
      <p className="text-[var(--muted)]">
        {missingSchema
          ? "The tournament table is not in the database yet. Apply the latest migration in supabase/migrations, then reload."
          : failed
            ? "The tournament could not be loaded. Try again in a moment."
            : "Add your project URL and anon key to .env.local, then apply the migrations in supabase/migrations."}
      </p>
      <Button asChild>
        <Link href="/demo">Open local demo</Link>
      </Button>
    </main>
  );
}
