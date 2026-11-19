export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && !url.includes("your-project"));
}

export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
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
