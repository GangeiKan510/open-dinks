import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/actions/session";
import { CreateVenueForm } from "@/components/venue/create-venue-form";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";
import { formatBrandTitle } from "@/lib/facility";
import { loadFacilityForAccount } from "@/lib/facility-server";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto max-w-lg space-y-4 px-6 py-16">
        <h1 className="text-3xl font-semibold">Connect Supabase</h1>
        <p className="text-[var(--muted)]">
          Copy <code>.env.example</code> to <code>.env.local</code>, add your
          project URL and anon key, then run the migration in{" "}
          <code>supabase/migrations</code>.
        </p>
        <Button asChild>
          <Link href="/demo">Open local demo</Link>
        </Button>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("venue_members")
    .select("role, venue_id")
    .eq("user_id", user.id);

  const venueIds = (memberships ?? []).map((m) => m.venue_id);
  const [{ data: venueRows }, facility] = await Promise.all([
    venueIds.length > 0
      ? supabase.from("venues").select("id, name, slug").in("id", venueIds)
      : Promise.resolve({
          data: [] as { id: string; name: string; slug: string }[],
        }),
    loadFacilityForAccount(user.id),
  ]);

  const venues = (venueRows ?? []).map((venue) => ({
    ...venue,
    role:
      memberships?.find((m) => m.venue_id === venue.id)?.role ??
      ("host" as const),
  }));

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            {formatBrandTitle(facility)}
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl">
            Your venues
          </h1>
        </div>
        <form action={signOutAction}>
          <Button variant="outline" type="submit">
            Sign out
          </Button>
        </form>
      </header>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="mb-4 font-semibold">Create venue</h2>
        <CreateVenueForm facility={facility} />
      </section>

      <section className="space-y-3">
        {venues.length === 0 ? (
          <p className="text-[var(--muted)]">No venues yet.</p>
        ) : (
          venues.map((v) => (
            <Link
              key={v.id}
              href={`/venues/${v.id}`}
              className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 transition hover:border-[var(--accent)]"
            >
              <div>
                <div className="font-medium">{v.name}</div>
                <div className="text-sm text-[var(--muted)]">/{v.slug}</div>
              </div>
              <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
                {v.role}
              </span>
            </Link>
          ))
        )}
      </section>
    </main>
  );
}
