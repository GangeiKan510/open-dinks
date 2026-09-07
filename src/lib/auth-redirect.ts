/**
 * Relative in-app redirect targets after OAuth / email confirmation.
 * Rejects open redirects (protocol-relative and absolute URLs).
 */
export function safeAuthNextPath(
  next: string | null | undefined,
  fallback: string = "/dashboard",
): string {
  if (typeof next !== "string") return fallback;
  const trimmed = next.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("://")) return fallback;
  return trimmed;
}

export type PublicBooker = {
  id: string;
  email: string | null;
  displayName: string;
};

export function publicBookerFromUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): PublicBooker {
  const meta = user.user_metadata ?? {};
  const fullName =
    typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  const name = typeof meta.name === "string" ? meta.name.trim() : "";
  const displayNameMeta =
    typeof meta.display_name === "string" ? meta.display_name.trim() : "";
  const displayName =
    fullName ||
    name ||
    displayNameMeta ||
    (user.email ? user.email.split("@")[0]! : "Guest");

  return {
    id: user.id,
    email: user.email ?? null,
    displayName,
  };
}
