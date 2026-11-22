import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { shouldRefreshAuthSession } from "@/lib/middleware-paths";
import {
  OPERATOR_COOKIE,
  OPERATOR_HOME,
  operatorMayPass,
  operatorRedirect,
} from "@/lib/operator-access";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import type { Database } from "@/lib/supabase/database.types";

function redirectWithCookies(
  request: NextRequest,
  pathname: string,
  from: NextResponse,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const response = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });
  return response;
}

function applyOperatorCookie(
  request: NextRequest,
  response: NextResponse,
  isOperator: boolean,
) {
  if (isOperator) {
    response.cookies.set(OPERATOR_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });
    return;
  }
  if (request.cookies.get(OPERATOR_COOKIE)) {
    response.cookies.set(OPERATOR_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (
    request.cookies.get(OPERATOR_COOKIE)?.value === "1" &&
    !operatorMayPass(pathname)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = OPERATOR_HOME;
    url.search = "";
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({ request });
  if (!shouldRefreshAuthSession(pathname)) {
    return supabaseResponse;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes("your-project")) {
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isOperator = false;
  if (user) {
    const { data, error } = await supabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error && !isMissingSchemaError(error)) {
      console.error("[admin] operator check failed", error.code);
    }
    isOperator = Boolean(data);
  }

  const destination = operatorRedirect({
    pathname,
    isOperator,
    signedIn: Boolean(user),
  });
  const response = destination
    ? redirectWithCookies(request, destination, supabaseResponse)
    : supabaseResponse;
  applyOperatorCookie(request, response, isOperator);
  return response;
}
