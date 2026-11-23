import { isSupabaseConfigured } from "@/lib/env";
import { planCatalogFromRow, type PlanCatalog } from "@/lib/platform-catalog";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";

/** Published prices and feature visibility. Defaults when the migration is not applied. */
export async function loadPlanCatalog(): Promise<PlanCatalog> {
  if (!isSupabaseConfigured()) return planCatalogFromRow(null);
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("platform_catalog");
    if (error) {
      if (!isMissingSchemaError(error)) {
        console.error("[catalog] load failed", error.code);
      }
      return planCatalogFromRow(null);
    }
    const row = data?.[0];
    return planCatalogFromRow(row);
  } catch (error) {
    console.error(
      "[catalog] load failed",
      error instanceof Error ? error.name : "unknown",
    );
    return planCatalogFromRow(null);
  }
}
