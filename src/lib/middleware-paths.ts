/** Paths that do not need a Supabase auth cookie refresh on every request. */
export function shouldRefreshAuthSession(pathname: string): boolean {
  if (pathname === "/") return false;
  if (pathname === "/robots.txt" || pathname === "/sitemap.xml") return false;
  if (
    pathname === "/tournament/board" ||
    pathname.startsWith("/tournament/board/")
  ) {
    return false;
  }
  if (
    pathname === "/tournament/umpire" ||
    pathname.startsWith("/tournament/umpire/")
  ) {
    return false;
  }
  // Public open-play views. The host console still refreshes the session.
  if (/^\/s\/[^/]+$/.test(pathname)) return false;
  if (/^\/s\/[^/]+\/board$/.test(pathname)) return false;
  return true;
}
