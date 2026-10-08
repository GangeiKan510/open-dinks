import { describe, expect, it } from "vitest";
import { activeCategory, addTeam } from "@/engine/tournament";
import {
  emptyTournamentEvent,
  isUntouchedTournament,
  readLegacyTournament,
  shouldAdoptLocalTournament,
  tournamentEventFromDocument,
} from "./tournament-document";

describe("tournament documents", () => {
  it("reads an older single-division save", () => {
    const raw = JSON.stringify({
      name: "HARAYA CUP",
      division: "Mens Beginners",
      courtCount: 3,
      phase: "setup",
      teams: [],
      groups: [],
      matches: [],
    });
    const event = readLegacyTournament(raw);
    expect(event?.name).toBe("HARAYA CUP");
    expect(event?.categories[0]?.division).toBe("Mens Beginners");
  });

  it("rejects a document that is not a tournament", () => {
    expect(tournamentEventFromDocument({ name: "nope" })).toBeNull();
    expect(readLegacyTournament("not json")).toBeNull();
  });

  it("adopts a local draw only when the saved row is still empty", () => {
    const remote = emptyTournamentEvent();
    expect(isUntouchedTournament(remote)).toBe(true);

    const local = emptyTournamentEvent();
    const withTeam = {
      ...local,
      categories: [addTeam(activeCategory(local), "Jules", "Sean")],
    };
    expect(shouldAdoptLocalTournament(remote, withTeam)).toBe(true);
    expect(shouldAdoptLocalTournament(withTeam, remote)).toBe(false);
    expect(shouldAdoptLocalTournament(remote, remote)).toBe(false);
  });
});
