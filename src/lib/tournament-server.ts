import { isSupabaseConfigured } from "@/lib/env";
import {
  emptyTournamentEvent,
  tournamentEventFromDocument,
  tournamentEventToJson,
} from "@/lib/tournament-document";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import type { TournamentEvent } from "@/engine/tournament";

export type DirectorTournament =
  | {
      status: "ready";
      id: string;
      publicToken: string;
      umpireToken: string;
      event: TournamentEvent;
    }
  | { status: "signed-out" }
  | { status: "unconfigured" }
  | { status: "missing-schema" }
  | { status: "error" };

type TournamentRow = {
  id: string;
  public_token: string;
  document: unknown;
};

function readyFromRow(
  row: TournamentRow,
  umpireToken = "",
): DirectorTournament {
  const event = tournamentEventFromDocument(row.document);
  if (!event) return { status: "error" };
  return {
    status: "ready",
    id: row.id,
    publicToken: row.public_token,
    umpireToken,
    event,
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

export async function loadDirectorTournament(): Promise<DirectorTournament> {
  if (!isSupabaseConfigured()) return { status: "unconfigured" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "signed-out" };

  const { data, error } = await supabase
    .from("tournaments")
    .select("id, public_token, document")
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
    if (ready.status !== "ready") return ready;
    const umpireToken = await loadUmpireToken(supabase);
    if (umpireToken === "error") return { status: "error" };
    return {
      ...ready,
      umpireToken: umpireToken === "missing-schema" ? "" : umpireToken,
    };
  }

  const { data: created, error: insertError } = await supabase
    .from("tournaments")
    .insert({
      created_by: user.id,
      document: tournamentEventToJson(emptyTournamentEvent()),
    })
    .select("id, public_token, document")
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
    .select("id, public_token, document")
    .eq("public_token", token)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("[tournament] board load failed", error.code);
    return null;
  }
  const ready = readyFromRow(data);
  return ready.status === "ready" ? ready : null;
}
