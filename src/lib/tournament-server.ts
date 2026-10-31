import {
  applyVenueCourtCount,
  type TournamentEvent,
} from "@/engine/tournament";
import { loadAccountVenue } from "@/lib/account-venue";
import { isPublicBooker } from "@/lib/host-access";
import { normalizeCourtCount } from "@/lib/court-count";
import { isSupabaseConfigured } from "@/lib/env";
import {
  emptyTournamentEvent,
  tournamentEventFromDocument,
  tournamentEventToJson,
} from "@/lib/tournament-document";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";

export type DirectorTournament =
  | {
      status: "ready";
      id: string;
      publicToken: string;
      umpireToken: string;
      event: TournamentEvent;
      updatedAt: string;
    }
  | { status: "signed-out" }
  | { status: "not-host" }
  | { status: "unconfigured" }
  | { status: "missing-schema" }
  | { status: "error" };

type TournamentRow = {
  id: string;
  public_token: string;
  document: unknown;
  updated_at?: string;
};

function readyFromRow(
  row: TournamentRow,
  umpireToken = "",
): DirectorTournament {
  const event = tournamentEventFromDocument(row.document);
  if (!event || !row.updated_at) return { status: "error" };
  return {
    status: "ready",
    id: row.id,
    publicToken: row.public_token,
    umpireToken,
    event,
    updatedAt: row.updated_at,
  };
}

async function loadUmpireToken(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | "missing-schema" | "error"> {
  const { data, error } = await supabase.rpc("director_umpire_token");
  if (error) {
    console.error("[tournament] umpire token failed", error.code);
    if (isMissingSchemaError(error)) return "missing-schema";
    return "error";
  }
  return typeof data === "string" ? data : "";
}

async function settingsCourtCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<number | null> {
  const venue = await loadAccountVenue(userId, supabase);
  if (!venue) return null;
  const { data, error } = await supabase
    .from("courts")
    .select("id")
    .eq("venue_id", venue.id);
  if (error || !data || data.length < 1) return null;
  return normalizeCourtCount(data.length);
}

/** Saved draws follow the facility court count. */
async function alignTournamentCourts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  row: { id: string; updated_at: string },
  event: TournamentEvent,
): Promise<{ event: TournamentEvent; updatedAt: string }> {
  const count = await settingsCourtCount(supabase, userId);
  if (count == null) return { event, updatedAt: row.updated_at };
  const next = applyVenueCourtCount(event, count);
  if (next === event) return { event, updatedAt: row.updated_at };

  const { data, error } = await supabase
    .from("tournaments")
    .update({ document: tournamentEventToJson(next) })
    .eq("id", row.id)
    .eq("updated_at", row.updated_at)
    .select("updated_at")
    .maybeSingle();
  if (error) {
    console.error("[tournament] court sync failed", error.code);
    return { event: next, updatedAt: row.updated_at };
  }
  if (data?.updated_at) return { event: next, updatedAt: data.updated_at };

  const fresh = await supabase
    .from("tournaments")
    .select("document, updated_at")
    .eq("id", row.id)
    .maybeSingle();
  const loaded = fresh.data
    ? tournamentEventFromDocument(fresh.data.document)
    : null;
  if (!loaded || !fresh.data?.updated_at) {
    return { event: next, updatedAt: row.updated_at };
  }
  return {
    event: applyVenueCourtCount(loaded, count),
    updatedAt: fresh.data.updated_at,
  };
}

export async function loadDirectorTournament(): Promise<DirectorTournament> {
  if (!isSupabaseConfigured()) return { status: "unconfigured" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "signed-out" };
  if (isPublicBooker(user)) {
    const venue = await loadAccountVenue(user.id, supabase);
    if (!venue) return { status: "not-host" };
  }

  const { data, error } = await supabase
    .from("tournaments")
    .select("id, public_token, document, updated_at")
    .eq("created_by", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[tournament] load failed", error.code);
    if (isMissingSchemaError(error)) return { status: "missing-schema" };
    return { status: "error" };
  }
  if (data) {
    const ready = readyFromRow(data);
    if (ready.status !== "ready" || !data.updated_at) {
      return ready.status === "ready" ? { status: "error" } : ready;
    }
    const aligned = await alignTournamentCourts(
      supabase,
      user.id,
      { id: data.id, updated_at: data.updated_at },
      ready.event,
    );
    const umpireToken = await loadUmpireToken(supabase);
    if (umpireToken === "error") return { status: "error" };
    return {
      ...ready,
      event: aligned.event,
      updatedAt: aligned.updatedAt,
      umpireToken: umpireToken === "missing-schema" ? "" : umpireToken,
    };
  }

  const courtCount = await settingsCourtCount(supabase, user.id);
  const createdEvent =
    courtCount == null
      ? emptyTournamentEvent()
      : applyVenueCourtCount(emptyTournamentEvent(), courtCount);
  const { data: created, error: insertError } = await supabase
    .from("tournaments")
    .insert({
      created_by: user.id,
      document: tournamentEventToJson(createdEvent),
    })
    .select("id, public_token, document, updated_at")
    .single();

  if (insertError || !created) {
    console.error("[tournament] create failed", insertError?.code);
    if (isMissingSchemaError(insertError)) return { status: "missing-schema" };
    return { status: "error" };
  }
  const ready = readyFromRow(created);
  if (ready.status !== "ready") return ready;
  const umpireToken = await loadUmpireToken(supabase);
  if (umpireToken === "error") return { status: "error" };
  return {
    ...ready,
    umpireToken: umpireToken === "missing-schema" ? "" : umpireToken,
  };
}

export async function loadTournamentByUmpireToken(
  token: string,
): Promise<{ id: string; event: TournamentEvent } | null> {
  if (!isSupabaseConfigured() || !token.trim()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("umpire_load_tournament", {
    p_token: token,
  });
  if (error || !data?.length) {
    if (error) console.error("[tournament] umpire load failed", error.code);
    return null;
  }
  const row = data[0];
  if (!row) return null;
  const event = tournamentEventFromDocument(row.document);
  if (!event) return null;
  return { id: row.id, event };
}

export async function loadTournamentByToken(
  token: string,
): Promise<Extract<DirectorTournament, { status: "ready" }> | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, public_token, document, updated_at")
    .eq("public_token", token)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("[tournament] board load failed", error.code);
    return null;
  }
  const ready = readyFromRow(data);
  return ready.status === "ready" ? ready : null;
}
