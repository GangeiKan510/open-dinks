import { describe, expect, it } from "vitest";
import { sponsorStoragePath } from "./sponsor-logo";

const tournamentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const fileId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("sponsor storage paths", () => {
  it("keeps a logo uploaded for this tournament", () => {
    const url = `https://example.supabase.co/storage/v1/object/public/tournament-sponsors/${tournamentId}/${fileId}.png`;
    expect(sponsorStoragePath(tournamentId, url)).toBe(
      `${tournamentId}/${fileId}.png`,
    );
  });

  it("rejects a logo that is not in this tournament folder", () => {
    const other = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const url = `https://example.supabase.co/storage/v1/object/public/tournament-sponsors/${other}/${fileId}.png`;
    expect(sponsorStoragePath(tournamentId, url)).toBeNull();
    expect(
      sponsorStoragePath(
        tournamentId,
        `https://example.supabase.co/storage/v1/object/public/tournament-sponsors/${tournamentId}/${fileId}.svg`,
      ),
    ).toBeNull();
    expect(
      sponsorStoragePath(tournamentId, "http://example.com/logo.png"),
    ).toBeNull();
    expect(
      sponsorStoragePath(
        "not-an-id",
        `https://example.supabase.co/tournament-sponsors/${tournamentId}/${fileId}.png`,
      ),
    ).toBeNull();
  });
});
