"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  parseTheme,
  THEME_COOKIE,
  THEME_ERROR_MESSAGES,
  themeCookieMaxAge,
  type ThemeId,
} from "@/lib/theme";

export async function updateAccountThemeAction(
  theme: ThemeId,
): Promise<{ ok: true } | { error: string }> {
  const parsed = parseTheme(theme);
  if (parsed !== theme) return { error: THEME_ERROR_MESSAGES.save };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: THEME_ERROR_MESSAGES.signIn };

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, theme: parsed });
  if (error) {
    console.error("[theme] update failed", error);
    return { error: THEME_ERROR_MESSAGES.save };
  }

  const jar = await cookies();
  jar.set(THEME_COOKIE, parsed, {
    path: "/",
    maxAge: themeCookieMaxAge(),
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return { ok: true };
}
