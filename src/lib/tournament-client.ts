import type { TournamentEvent } from "@/engine/tournament";
import type { MatchFieldPatch } from "@/lib/umpire-patches";
import {
  tournamentEventFromDocument,
  tournamentEventToJson,
} from "@/lib/tournament-document";
import { createClient } from "@/lib/supabase/client";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import type { Json } from "@/lib/supabase/database.types";

export type SaveTournamentResult =
  | { ok: true; updatedAt: string }
  | {
      ok: false;
      missingSchema: boolean;
      conflict: boolean;
      event?: TournamentEvent;
      updatedAt?: string;
    };

export type SaveUmpireResult =
  | { ok: true; event: TournamentEvent; updatedAt: string }
  | { ok: false; missingSchema: boolean };

export async function saveTournamentDocument(
  tournamentId: string,
  event: TournamentEvent,
  expectedUpdatedAt: string,
): Promise<SaveTournamentResult> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tournaments")
    .update({ document: tournamentEventToJson(event) })
    .eq("id", tournamentId)
    .eq("updated_at", expectedUpdatedAt)
    .select("updated_at")
    .maybeSingle();
  if (error) {
    console.error("[tournament] save failed", error.code);
    return {
      ok: false,
      missingSchema: isMissingSchemaError(error),
      conflict: false,
    };
  }
  if (data) return { ok: true, updatedAt: data.updated_at };

  const fresh = await supabase
    .from("tournaments")
    .select("document, updated_at")
    .eq("id", tournamentId)
    .maybeSingle();
  const loaded = fresh.data
    ? tournamentEventFromDocument(fresh.data.document)
    : null;
  return {
    ok: false,
    missingSchema: false,
    conflict: true,
    event: loaded ?? undefined,
    updatedAt: fresh.data?.updated_at,
  };
}

export async function saveUmpirePatches(
  token: string,
  patches: MatchFieldPatch[],
): Promise<SaveUmpireResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("umpire_save_match_patches", {
    p_token: token,
    p_patches: patches as unknown as Json,
  });
  if (error) {
    console.error("[tournament] umpire save failed", error.code);
    return { ok: false, missingSchema: isMissingSchemaError(error) };
  }
  const payload = data as { document?: unknown; updated_at?: unknown } | null;
  const event = tournamentEventFromDocument(payload?.document);
  if (!event || typeof payload?.updated_at !== "string") {
    return { ok: false, missingSchema: false };
  }
  return { ok: true, event, updatedAt: payload.updated_at };
}
