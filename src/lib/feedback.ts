import { ADMIN_ERROR_MESSAGES } from "@/lib/admin-messages";

export const FEEDBACK_MIN = 8;
export const FEEDBACK_MAX = 2000;
export const FEEDBACK_NAME_MIN = 2;
export const FEEDBACK_NAME_MAX = 80;
export const FEEDBACK_LOGO_BUCKET = "feedback-logos";
export const MAX_FEEDBACK_LOGO_BYTES = 2 * 1024 * 1024;

const LOGO_FILE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/i;

const LOGO_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
} as const;

export type FeedbackLogoExtension = keyof typeof LOGO_TYPES;

export type FeedbackDraft =
  | { ok: true; ignored: true }
  | {
      ok: true;
      ignored: false;
      body: string;
      rating: number | null;
      authorName: string;
    }
  | { ok: false; error: string };

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Anonymous notes. A filled honeypot is accepted and then dropped so a bot
 * is not told which field failed. No account id is stored.
 */
export function parseFeedbackSubmission(input: {
  body: unknown;
  rating: unknown;
  website: unknown;
  name: unknown;
}): FeedbackDraft {
  if (text(input.website).trim()) return { ok: true, ignored: true };

  const authorName = text(input.name).trim();
  if (authorName.length < FEEDBACK_NAME_MIN) {
    return { ok: false, error: ADMIN_ERROR_MESSAGES.feedbackName };
  }
  if (authorName.length > FEEDBACK_NAME_MAX) {
    return { ok: false, error: ADMIN_ERROR_MESSAGES.feedbackNameLong };
  }

  const body = text(input.body).trim();
  if (body.length < FEEDBACK_MIN) {
    return { ok: false, error: ADMIN_ERROR_MESSAGES.feedbackShort };
  }
  if (body.length > FEEDBACK_MAX) {
    return { ok: false, error: ADMIN_ERROR_MESSAGES.feedbackLong };
  }

  const ratingText = text(input.rating).trim();
  if (!ratingText) {
    return { ok: true, ignored: false, body, rating: null, authorName };
  }
  if (!/^[1-5]$/.test(ratingText)) {
    return { ok: false, error: ADMIN_ERROR_MESSAGES.feedbackRating };
  }
  return {
    ok: true,
    ignored: false,
    body,
    rating: Number(ratingText),
    authorName,
  };
}

export function ratingStars(rating: number | null): string | null {
  if (rating == null || rating < 1 || rating > 5) return null;
  return `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`;
}

export function feedbackLogoExtension(file: {
  type: string;
  name: string;
}): FeedbackLogoExtension | null {
  const type = file.type.toLowerCase();
  if (type === LOGO_TYPES.png) return "png";
  if (type === LOGO_TYPES.jpg) return "jpg";
  if (type === LOGO_TYPES.webp) return "webp";
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "jpg";
  if (name.endsWith(".webp")) return "webp";
  return null;
}

/** Why a chosen logo cannot be stored. An empty file is not a logo. */
export function feedbackLogoProblem(file: {
  size: number;
  type: string;
  name: string;
}): string | null {
  if (file.size <= 0) return null;
  if (!feedbackLogoExtension(file))
    return ADMIN_ERROR_MESSAGES.feedbackLogoType;
  if (file.size > MAX_FEEDBACK_LOGO_BYTES) {
    return ADMIN_ERROR_MESSAGES.feedbackLogoSize;
  }
  return null;
}

/** Public logo for this note, or null when the URL is not our stored file. */
export function feedbackLogoSrc(id: string, url: unknown): string | null {
  if (typeof url !== "string" || !url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const marker = `/object/public/${FEEDBACK_LOGO_BUCKET}/`;
  const index = parsed.pathname.indexOf(marker);
  if (index === -1) return null;
  const file = decodeURIComponent(
    parsed.pathname.slice(index + marker.length),
  ).toLowerCase();
  const expected = id.toLowerCase();
  if (
    file !== `${expected}.png` &&
    file !== `${expected}.jpg` &&
    file !== `${expected}.webp`
  ) {
    return null;
  }
  if (!LOGO_FILE.test(file) || file.includes("/")) return null;
  return `${parsed.origin}${parsed.pathname}`;
}
