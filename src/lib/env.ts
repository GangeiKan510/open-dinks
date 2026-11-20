export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && !url.includes("your-project"));
}

function configuredSiteUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(
    /\/$/,
    "",
  );
  return configured || null;
}

/** Vercel provides the hostname only. A scheme, if present, is kept. */
function vercelOrigin(
  name: "VERCEL_PROJECT_PRODUCTION_URL" | "VERCEL_URL",
): string | null {
  const host = process.env[name]?.trim().replace(/\/$/, "");
  if (!host) return null;
  const withProtocol = /^https?:\/\//i.test(host) ? host : `https://${host}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function siteUrl(): string {
  return (
    configuredSiteUrl() ??
    vercelOrigin("VERCEL_PROJECT_PRODUCTION_URL") ??
    vercelOrigin("VERCEL_URL") ??
    "http://localhost:3000"
  );
}

export function isLocalSite(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  try {
    const host = new URL(siteUrl()).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}
