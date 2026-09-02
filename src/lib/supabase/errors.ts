/** The shape Supabase returns for both PostgREST and RPC failures. */
export type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

/** PostgREST cannot see the relation; Postgres does not have it at all. */
const MISSING_SCHEMA_CODES = new Set([
  "PGRST202", // function not found in schema cache
  "PGRST205", // table not found in schema cache
  "42P01", // undefined_table
  "42883", // undefined_function
]);

/**
 * True when a query failed because the table or function does not exist yet,
 * which in practice means the migrations have not been applied. Worth telling
 * the user directly instead of showing a generic "try again".
 */
export function isMissingSchemaError(
  error: SupabaseErrorLike | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code && MISSING_SCHEMA_CODES.has(error.code)) return true;

  const message = (error.message ?? "").toLowerCase();
  return (
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("could not find the function")
  );
}
