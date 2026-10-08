/** Paths that do not need a Supabase auth cookie refresh on every request. */
export function shouldRefreshAuthSession(pathname: string): boolean {
  if (pathname === "/") return false;
  if (pathname === "/demo" || pathname.startsWith("/demo/")) return false;
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
  return true;
}
