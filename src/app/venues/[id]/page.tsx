import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  addRosterPlayerAction,
  createSessionAction,
  updateFacilityAction,
} from "@/app/actions/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_SKILL_TIER,
  formatSkillBand,
  formatSkillTier,
  SKILL_TIERS,
} from "@/lib/skill-tier";
import {
  DEFAULT_COURT_COUNT,
  MAX_COURT_COUNT,
  MIN_COURT_COUNT,
} from "@/lib/court-count";
import { formatBrandTitle, facilityFromRow } from "@/lib/facility";
import { createClient } from "@/lib/supabase/server";

export default async function VenuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: venue } = await supabase
    .from("venues")
    .select("*")
    .eq("id", id)
    .single();
  if (!venue) notFound();

  const [
    { data: courts },
    { data: players },
    { data: sessions },
    { data: facilityRow },
  ] = await Promise.all([
    supabase.from("courts").select("*").eq("venue_id", id).order("sort_order"),
    supabase.from("players").select("*").eq("venue_id", id).order("name"),
    supabase
      .from("sessions")
      .select("*")
      .eq("venue_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("facilities")
      .select("id, slug, name, short_name, tagline")
      .eq("id", venue.facility_id)
      .single(),
  ]);

  const facility = facilityRow ? facilityFromRow(facilityRow) : null;

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/dashboard" className="text-sm text-[var(--muted)]">
            ← Dashboard
          </Link>
          <h1 className="font-[family-name:var(--font-display)] text-4xl">
            {venue.name}
          </h1>
          {facility ? (
            <p className="mt-1 text-sm text-[var(--muted)]">
              {formatBrandTitle(facility)}
            </p>
          ) : null}
        </div>
      </div>

      {facility && facilityRow ? (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-1 font-semibold">Facility branding</h2>
          <p className="mb-4 text-sm text-[var(--muted)]">
            Shown on the wallboard, player view, and co-branded titles as{" "}
            <span className="font-medium text-[var(--foreground)]">
              {formatBrandTitle(facility)}
            </span>
            .
          </p>
          <form
            action={updateFacilityAction}
            className="grid gap-3 md:grid-cols-2"
          >
            <input type="hidden" name="venueId" value={venue.id} />
            <input type="hidden" name="facilityId" value={facilityRow.id} />
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="facilityName">Facility name</Label>
              <Input
                id="facilityName"
                name="name"
                defaultValue={facilityRow.name}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="facilityShortName">Short name</Label>
              <Input
                id="facilityShortName"
                name="shortName"
                defaultValue={facilityRow.short_name}
                required
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="facilityTagline">Tagline</Label>
              <Input
                id="facilityTagline"
                name="tagline"
                defaultValue={facilityRow.tagline}
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" variant="secondary">
                Save branding
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="mb-4 font-semibold">Start open play</h2>
        <form
          action={createSessionAction}
          className="grid gap-3 md:grid-cols-3"
        >
          <input type="hidden" name="venueId" value={venue.id} />
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" defaultValue="Weeknight Open Play" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="courtCount">Courts in play</Label>
            <Input
              id="courtCount"
              name="courtCount"
              type="number"
              min={MIN_COURT_COUNT}
              max={MAX_COURT_COUNT}
              defaultValue={Math.max(
                MIN_COURT_COUNT,
                courts?.length || DEFAULT_COURT_COUNT,
              )}
              required
            />
            <p className="text-xs text-[var(--muted)]">
              {courts?.length ?? 0} configured at this venue · min{" "}
              {MIN_COURT_COUNT}, max {MAX_COURT_COUNT}
            </p>
          </div>
          <div className="md:col-span-3">
            <Button type="submit">Go live</Button>
          </div>
        </form>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-3 font-semibold">Courts</h2>
          <ul className="space-y-2 text-sm">
            {(courts ?? []).map((c) => (
              <li key={c.id} className="flex justify-between">
                <span>{c.name}</span>
                <span className="text-[var(--muted)]">
                  {c.skill_min != null
                    ? formatSkillBand(c.skill_min, c.skill_max)
                    : "Any skill"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-3 font-semibold">Roster</h2>
          <form action={addRosterPlayerAction} className="mb-4 flex gap-2">
            <input type="hidden" name="venueId" value={venue.id} />
            <Input name="name" placeholder="Player name" required />
            <select
              name="skill"
              defaultValue={DEFAULT_SKILL_TIER}
              className="h-10 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 text-sm"
            >
              {SKILL_TIERS.map((tier) => (
                <option key={tier} value={tier}>
                  {formatSkillTier(tier)}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary">
              Add
            </Button>
          </form>
          <ul className="max-h-64 space-y-2 overflow-auto text-sm">
            {(players ?? []).map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>{p.name}</span>
                <span className="text-[var(--muted)]">
                  {formatSkillTier(p.skill)}
                </span>
              </li>
            ))}
            {(players ?? []).length === 0 ? (
              <li className="text-[var(--muted)]">No saved players yet</li>
            ) : null}
          </ul>
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">Recent sessions</h2>
        {(sessions ?? []).map((s) => (
          <Link
            key={s.id}
            href={`/s/${s.public_token}/host`}
            className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm"
          >
            <span>
              {s.title} · <span className="capitalize">{s.status}</span>
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}
