import { createClient } from "@/lib/supabase/client";

export const SPONSOR_BUCKET = "tournament-sponsors";
export const MAX_SPONSOR_LOGO_BYTES = 2 * 1024 * 1024;

const TOURNAMENT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORED_FILE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/i;

const CONTENT_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
} as const;

type LogoExtension = keyof typeof CONTENT_TYPES;

export type SponsorLogoResult =
  | { ok: true; id: string; url: string }
  | { ok: false; message: string; missingSchema: boolean };

type StorageFailure = {
  message?: string;
  statusCode?: string | number;
};

/** Object path for a logo this tournament uploaded. Null for any other URL. */
export function sponsorStoragePath(
  tournamentId: string,
  url: string,
): string | null {
  if (!TOURNAMENT_ID.test(tournamentId)) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const marker = `/${SPONSOR_BUCKET}/${tournamentId}/`;
  const index = parsed.pathname.indexOf(marker);
  if (index === -1) return null;
  const file = decodeURIComponent(parsed.pathname.slice(index + marker.length));
  if (!STORED_FILE.test(file) || file.includes("/")) return null;
  return `${tournamentId}/${file}`;
}

export async function uploadSponsorLogo(
  tournamentId: string,
  file: File,
): Promise<SponsorLogoResult> {
  if (!TOURNAMENT_ID.test(tournamentId)) {
    return {
      ok: false,
      missingSchema: false,
      message:
        "Could not upload the logo. Check your connection and try again.",
    };
  }
  const extension = logoExtension(file);
  if (!extension) {
    return {
      ok: false,
      missingSchema: false,
      message: "Use a PNG, JPEG, or WebP image.",
    };
  }
  if (file.size <= 0 || file.size > MAX_SPONSOR_LOGO_BYTES) {
    return {
      ok: false,
      missingSchema: false,
      message: "Sponsor logos must be 2 MB or smaller.",
    };
  }

  const id = crypto.randomUUID();
  const path = `${tournamentId}/${id}.${extension}`;
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(SPONSOR_BUCKET)
    .upload(path, file, {
      contentType: CONTENT_TYPES[extension],
      upsert: false,
      cacheControl: "3600",
    });
  if (error) {
    console.error(
      "[tournament] sponsor upload failed",
      storageCode(error as StorageFailure),
    );
    return {
      ok: false,
      missingSchema: isMissingBucket(error as StorageFailure),
      message: isMissingBucket(error as StorageFailure)
        ? "Apply the latest database migration to turn on sponsor logos."
        : "Could not upload the logo. Check your connection and try again.",
    };
  }

  const { data } = supabase.storage.from(SPONSOR_BUCKET).getPublicUrl(path);
  if (!data.publicUrl.startsWith("https://")) {
    await supabase.storage.from(SPONSOR_BUCKET).remove([path]);
    return {
      ok: false,
      missingSchema: false,
      message:
        "Could not upload the logo. Check your connection and try again.",
    };
  }
  return { ok: true, id, url: data.publicUrl };
}

export async function deleteSponsorLogo(
  tournamentId: string,
  url: string,
): Promise<void> {
  const path = sponsorStoragePath(tournamentId, url);
  if (!path) return;
  const supabase = createClient();
  const { error } = await supabase.storage.from(SPONSOR_BUCKET).remove([path]);
  if (error) {
    console.error(
      "[tournament] sponsor delete failed",
      storageCode(error as StorageFailure),
    );
  }
}

function logoExtension(file: File): LogoExtension | null {
  const type = file.type.toLowerCase();
  if (type === "image/png") return "png";
  if (type === "image/jpeg") return "jpg";
  if (type === "image/webp") return "webp";
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "jpg";
  if (name.endsWith(".webp")) return "webp";
  return null;
}

function isMissingBucket(error: StorageFailure): boolean {
  const message = (error.message ?? "").toLowerCase();
  return (
    message.includes("bucket not found") || message.includes("does not exist")
  );
}

function storageCode(error: StorageFailure): string {
  if (error.statusCode == null) return "";
  return String(error.statusCode);
}
