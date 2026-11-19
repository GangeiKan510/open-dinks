import { feedbackLogoSrc } from "@/lib/feedback";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isMissingSchemaError } from "@/lib/supabase/errors";

export type FeaturedReview = {
  id: string;
  body: string;
  rating: number | null;
  logoUrl: string | null;
  authorName: string | null;
  createdAt: string;
};

export async function loadFeaturedReviews(): Promise<FeaturedReview[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("featured_feedback");
    if (error) {
      if (!isMissingSchemaError(error)) {
        console.error("[feedback] featured failed", error.code);
      }
      return [];
    }
    return (data ?? []).map((row) => ({
      id: row.id,
      body: row.body,
      rating: row.rating,
      logoUrl: feedbackLogoSrc(row.id, row.logo_url),
      authorName: row.author_name,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error(
      "[feedback] featured failed",
      error instanceof Error ? error.name : "unknown",
    );
    return [];
  }
}
