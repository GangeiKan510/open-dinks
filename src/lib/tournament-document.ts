import {
  createTournamentEvent,
  isTournamentEvent,
  isTournamentState,
  normalizeTournamentEvent,
  tournamentEventFromState,
  type TournamentEvent,
} from "@/engine/tournament";
import type { Json } from "@/lib/supabase/database.types";

export const LEGACY_TOURNAMENT_STORAGE_KEY = "opendinks.tournament.v1";

const DEFAULT_NAME = "Saturday mixer";
const DEFAULT_DIVISION = "Mixed 3.5";

export function tournamentEventFromDocument(
  value: unknown,
): TournamentEvent | null {
  if (isTournamentEvent(value)) return normalizeTournamentEvent(value);
  if (isTournamentState(value)) {
    return normalizeTournamentEvent(tournamentEventFromState(value));
  }
  return null;
}

export function tournamentEventToJson(event: TournamentEvent): Json {
  return JSON.parse(JSON.stringify(event)) as Json;
}

export function readLegacyTournament(
  raw: string | null,
): TournamentEvent | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return tournamentEventFromDocument(parsed);
  } catch {
    return null;
  }
}

/** A row we just created, before the director has typed anything. */
export function isUntouchedTournament(event: TournamentEvent): boolean {
  if (event.categories.length !== 1) return false;
  const category = event.categories[0];
  if (!category) return false;
  if (category.phase !== "setup") return false;
  if (category.teams.length > 0 || category.matches.length > 0) return false;
  const name = event.name.trim();
  if (name !== "" && name !== DEFAULT_NAME) return false;
  const division = category.division.trim();
  return division === "" || division === DEFAULT_DIVISION;
}

/**
 * Move a browser-only draw into the database once, and only when the account
 * row is still the empty default.
 */
export function shouldAdoptLocalTournament(
  remote: TournamentEvent,
  local: TournamentEvent,
): boolean {
  return isUntouchedTournament(remote) && !isUntouchedTournament(local);
}

export function emptyTournamentEvent(): TournamentEvent {
  return createTournamentEvent();
}
