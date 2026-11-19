"use server";

import { cookies } from "next/headers";
import { ADMIN_ERROR_MESSAGES } from "@/lib/admin-messages";
import {
  FEEDBACK_LOGO_BUCKET,
  feedbackLogoExtension,
  feedbackLogoProblem,
  feedbackLogoSrc,
  parseFeedbackSubmission,
  type FeedbackLogoExtension,
} from "@/lib/feedback";
import { isSupabaseConfigured } from "@/lib/env";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/service";

const LOGO_CONTENT_TYPE: Record<FeedbackLogoExtension, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

const FEEDBACK_COOKIE = "od_feedback_at";
const FEEDBACK_WAIT_MS = 30_000;

export async function submitFeedbackAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const draft = parseFeedbackSubmission({
    body: formData.get("body"),
    name: formData.get("name"),
    rating: formData.get("rating"),
    website: formData.get("website"),
  });
  if (!draft.ok) return draft;
  if (draft.ignored) return { ok: true };

  const logo = logoFromForm(formData.get("logo"));
  if (logo) {
    const problem = feedbackLogoProblem(logo);
    if (problem) return { ok: false, error: problem };
    if (!isServiceRoleConfigured()) {
      return { ok: false, error: ADMIN_ERROR_MESSAGES.feedbackLogoFailed };
    }
  }
  if (!isSupabaseConfigured()) {
    return { ok: false, error: ADMIN_ERROR_MESSAGES.feedbackFailedSubmit };
  }

  const jar = await cookies();
  const previous = Number(jar.get(FEEDBACK_COOKIE)?.value ?? "");
  if (Number.isFinite(previous) && Date.now() - previous < FEEDBACK_WAIT_MS) {
    return { ok: false, error: ADMIN_ERROR_MESSAGES.feedbackWait };
  }

  const id = crypto.randomUUID();
  const supabase = await createClient();
  const { error } = await supabase.from("feedback").insert({
    id,
    body: draft.body,
    author_name: draft.authorName,
    rating: draft.rating,
    featured: false,
  });
  if (error) {
    if (isMissingSchemaError(error)) {
      return { ok: false, error: ADMIN_ERROR_MESSAGES.missingSchema };
    }
    console.error("[feedback] insert failed", error.code);
    return { ok: false, error: ADMIN_ERROR_MESSAGES.feedbackFailedSubmit };
  }

  const extension = logo ? feedbackLogoExtension(logo) : null;
  const logoPath = extension ? `${id}.${extension}` : null;
  if (logo && logoPath && extension) {
    const uploaded = await uploadFeedbackLogo(logoPath, logo, extension);
    const saved = uploaded && (await attachFeedbackLogo(id, logoPath));
    if (!uploaded || !saved) {
      await removeFeedbackLogo(logoPath);
      if (isServiceRoleConfigured()) {
        const service = createServiceClient();
        const { error: deleteError } = await service
          .from("feedback")
          .delete()
          .eq("id", id);
        if (deleteError) {
          console.error("[feedback] logo rollback failed", deleteError.code);
        }
      }
      return { ok: false, error: ADMIN_ERROR_MESSAGES.feedbackLogoFailed };
    }
  }

  jar.set(FEEDBACK_COOKIE, String(Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60,
  });
  return { ok: true };
}

function logoFromForm(value: FormDataEntryValue | null): File | null {
  if (!value || typeof value === "string" || value.size <= 0) return null;
  return value;
}

async function uploadFeedbackLogo(
  path: string,
  file: File,
  extension: FeedbackLogoExtension,
): Promise<boolean> {
  const service = createServiceClient();
  const { error } = await service.storage
    .from(FEEDBACK_LOGO_BUCKET)
    .upload(path, file, {
      contentType: LOGO_CONTENT_TYPE[extension],
      upsert: false,
      cacheControl: "3600",
    });
  if (error) {
    console.error(
      "[feedback] logo upload failed",
      "statusCode" in error && error.statusCode != null
        ? String(error.statusCode)
        : "",
    );
    return false;
  }
  return true;
}

async function attachFeedbackLogo(id: string, path: string): Promise<boolean> {
  const service = createServiceClient();
  const { data } = service.storage
    .from(FEEDBACK_LOGO_BUCKET)
    .getPublicUrl(path);
  const url = feedbackLogoSrc(id, data.publicUrl);
  if (!url) {
    console.error("[feedback] logo url rejected");
    return false;
  }
  const { error } = await service
    .from("feedback")
    .update({ logo_url: url })
    .eq("id", id);
  if (error) {
    console.error("[feedback] logo save failed", error.code);
    return false;
  }
  return true;
}

async function removeFeedbackLogo(path: string | null): Promise<void> {
  if (!path || !isServiceRoleConfigured()) return;
  const service = createServiceClient();
  const { error } = await service.storage
    .from(FEEDBACK_LOGO_BUCKET)
    .remove([path]);
  if (error) {
    console.error(
      "[feedback] logo remove failed",
      "statusCode" in error && error.statusCode != null
        ? String(error.statusCode)
        : "",
    );
  }
}
