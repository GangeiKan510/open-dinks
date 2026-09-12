/** Paths that do not need a Supabase auth cookie refresh on every request. */
export function shouldRefreshAuthSession(pathname: string): boolean {
  if (pathname === "/") return false;
  if (pathname === "/demo" || pathname.startsWith("/demo/")) return false;
  return true;
}
