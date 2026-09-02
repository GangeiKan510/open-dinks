import type { Database } from "@/lib/supabase/database.types";
import type { createClient } from "@/lib/supabase/server";

export type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/** Most recently started live session wins; ties break on created_at. */
export function compareLiveSessions(a: SessionRow, b: SessionRow): number {
  const aStart = a.started_at ? new Date(a.started_at).getTime() : 0;
  const bStart = b.started_at ? new Date(b.started_at).getTime() : 0;
  if (bStart !== aStart) return bStart - aStart;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

/** Pick the one live session that should stay active when several exist. */
export function canonicalLiveSession(
  sessions: SessionRow[],
): SessionRow | null {
  const live = sessions.filter((s) => s.status === "live");
  if (live.length === 0) return null;
  return [...live].sort(compareLiveSessions)[0] ?? null;
}

/**
 * Retires every live session except the canonical one. Repairs venues that
 * accumulated multiple live rows before the unique index migration ran.
 */
export async function ensureSingleLiveSession(
  supabase: SupabaseServer,
  venueId: string,
): Promise<SessionRow | null> {
  const { data: liveSessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("venue_id", venueId)
    .eq("status", "live");

  const rows = liveSessions ?? [];
  const keeper = canonicalLiveSession(rows);
  if (!keeper) return null;

  const staleIds = rows.filter((s) => s.id !== keeper.id).map((s) => s.id);
  if (staleIds.length > 0) {
    const endedAt = new Date().toISOString();
    await supabase
      .from("sessions")
      .update({ status: "completed", ended_at: endedAt })
      .in("id", staleIds);
  }

  return keeper;
}
