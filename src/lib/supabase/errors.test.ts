import { describe, expect, it } from "vitest";
import { isMissingSchemaError } from "@/lib/supabase/errors";

describe("isMissingSchemaError", () => {
  it("detects a table missing from the PostgREST schema cache", () => {
    expect(
      isMissingSchemaError({
        code: "PGRST205",
        message:
          "Could not find the table 'public.bookings' in the schema cache",
      }),
    ).toBe(true);
  });

  it("detects a missing RPC", () => {
    expect(isMissingSchemaError({ code: "PGRST202", message: null })).toBe(
      true,
    );
    expect(isMissingSchemaError({ code: "42883" })).toBe(true);
  });

  it("detects the raw Postgres undefined_table code", () => {
    expect(isMissingSchemaError({ code: "42P01" })).toBe(true);
  });

  it("falls back to the message when no code is present", () => {
    expect(
      isMissingSchemaError({ message: 'relation "bookings" does not exist' }),
    ).toBe(true);
  });

  it("does not flag ordinary failures as a missing migration", () => {
    expect(isMissingSchemaError(null)).toBe(false);
    expect(isMissingSchemaError(undefined)).toBe(false);
    expect(isMissingSchemaError({})).toBe(false);
    expect(
      isMissingSchemaError({
        code: "23P01",
        message: "conflicting key value violates exclusion constraint",
      }),
    ).toBe(false);
    expect(
      isMissingSchemaError({
        code: "42501",
        message: "new row violates row-level security policy",
      }),
    ).toBe(false);
  });
});
