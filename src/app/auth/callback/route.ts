import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeAuthNextPath } from "@/lib/auth-redirect";
import { parseTheme, THEME_COOKIE, themeCookieMaxAge } from "@/lib/theme";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeAuthNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);
      const userId = data.session?.user.id;
      if (userId) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("theme")
          .eq("id", userId)
          .maybeSingle();
        if (!profileError) {
          response.cookies.set(THEME_COOKIE, parseTheme(profile?.theme), {
            path: "/",
            maxAge: themeCookieMaxAge(),
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
          });
        }
      }
      return response;
    }
  }

  const errorTarget = next.startsWith("/book/")
    ? `${next}${next.includes("?") ? "&" : "?"}error=auth`
    : "/login?error=auth";
  return NextResponse.redirect(`${origin}${errorTarget}`);
}
