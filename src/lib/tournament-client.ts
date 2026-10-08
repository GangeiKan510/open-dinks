import type { TournamentEvent } from "@/engine/tournament";
import { tournamentEventToJson } from "@/lib/tournament-document";
import { createClient } from "@/lib/supabase/client";
import { isMissingSchemaError } from "@/lib/supabase/errors";

export type SaveTournamentResult =
  { ok: true } | { ok: false; missingSchema: boolean };

export async function saveTournamentDocument(
  tournamentId: string,
  event: TournamentEvent,
): Promise<SaveTournamentResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("tournaments")
    .update({ document: tournamentEventToJson(event) })
    .eq("id", tournamentId);
  if (!error) return { ok: true };
  console.error("[tournament] save failed", error.code);
  return { ok: false, missingSchema: isMissingSchemaError(error) };
}

export async function saveUmpireDocument(
  token: string,
  event: TournamentEvent,
): Promise<SaveTournamentResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("umpire_save_tournament", {
    p_token: token,
    p_document: tournamentEventToJson(event),
  });
  if (!error) return { ok: true };
  console.error("[tournament] umpire save failed", error.code);
  return { ok: false, missingSchema: isMissingSchemaError(error) };
}
