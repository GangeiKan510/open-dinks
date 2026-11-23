import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TournamentDirector } from "@/components/tournament/tournament-director";
import { loadDirectorTournament } from "@/lib/tournament-server";
import { loadPlanCatalog } from "@/lib/platform-catalog-server";

export const metadata: Metadata = {
  title: "Tournament",
  description:
    "Run a pickleball tournament with categories playing at once, shared courts, standings, and brackets.",
};

export default async function TournamentPage() {
  if (!(await loadPlanCatalog()).tournament) {
    return <TournamentUnavailable closed />;
  }
  const tournament = await loadDirectorTournament();
  if (tournament.status === "signed-out") {
    redirect("/login?next=/tournament");
  }
  if (tournament.status === "not-host") {
    redirect("/");
  }
  if (tournament.status === "unconfigured") {
    return <TournamentUnavailable />;
  }
  if (tournament.status === "missing-schema") {
    return <TournamentUnavailable missingSchema />;
  }
  if (tournament.status === "locked") {
    redirect("/dashboard?plans=open");
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
      initialUpdatedAt={tournament.updatedAt}
      bracketsOpen={tournament.bracketsOpen}
      bracketDates={tournament.bracketDates}
    />
  );
}

function TournamentUnavailable({
  missingSchema = false,
  failed = false,
  closed = false,
}: {
  missingSchema?: boolean;
  failed?: boolean;
  closed?: boolean;
}) {
  return (
    <main className="mx-auto max-w-lg space-y-4 px-6 py-16">
      <h1 className="font-[family-name:var(--font-display)] text-4xl">
        {closed
          ? "Tournament mode is not open yet"
          : failed
            ? "Could not open the tournament"
            : "Connect Supabase"}
      </h1>
      <p className="text-[var(--muted)]">
        {closed
          ? "Tournament setup is hidden until an operator turns it on."
          : missingSchema
            ? "The tournament table is not in the database yet. Apply the latest migration in supabase/migrations, then reload."
            : failed
              ? "The tournament could not be loaded. Try again in a moment."
              : "Add your project URL and anon key to .env.local, then apply the migrations in supabase/migrations."}
      </p>
    </main>
  );
}
