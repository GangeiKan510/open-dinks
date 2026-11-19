import { ADMIN_ERROR_MESSAGES } from "@/lib/admin-messages";

/**
 * Platform operator routes.
 *
 * An operator account monitors sales, clubs, and feedback. It cannot open the
 * host product. Hosts and players cannot open the operator panel.
 */

export const OPERATOR_HOME = "/admin";
export const OPERATOR_LOGIN = "/admin/login";
export const OPERATOR_COOKIE = "od_operator";

export function isOperatorRoute(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function isOperatorLoginPath(pathname: string): boolean {
  return pathname === "/admin/login" || pathname.startsWith("/admin/login/");
}

/** Public and machine routes that must keep working with an operator cookie. */
export function operatorMayPass(pathname: string): boolean {
  if (isOperatorRoute(pathname)) return true;
  if (pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/auth/")) return true;
  return false;
}

/**
 * Where this request should go. Null keeps the current path.
 * Operators are sent home from every product route. Everyone else is sent
 * away from the panel.
 */
export function operatorRedirect(input: {
  pathname: string;
  isOperator: boolean;
  signedIn: boolean;
}): string | null {
  const { pathname, isOperator, signedIn } = input;
  if (isOperator) {
    if (!isOperatorRoute(pathname)) return OPERATOR_HOME;
    if (isOperatorLoginPath(pathname)) return OPERATOR_HOME;
    return null;
  }
  if (isOperatorRoute(pathname) && !isOperatorLoginPath(pathname)) {
    return signedIn ? "/dashboard" : OPERATOR_LOGIN;
  }
  return null;
}

/** Constant-time compare for the one-time production setup key. */
export function setupKeyMatches(
  provided: string,
  configured: string | undefined,
): boolean {
  const expected = (configured ?? "").trim();
  const actual = provided.trim();
  if (expected.length < 8 || actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  }
  return diff === 0;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseOperatorDraft(input: {
  email: unknown;
  password: unknown;
  displayName: unknown;
}):
  | { ok: true; email: string; password: string; displayName: string }
  | { ok: false; error: string } {
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const password = typeof input.password === "string" ? input.password : "";
  const displayName =
    typeof input.displayName === "string" ? input.displayName.trim() : "";
  if (!EMAIL_PATTERN.test(email) || email.length > 200) {
    return { ok: false, error: ADMIN_ERROR_MESSAGES.email };
  }
  if (password.length < 8 || password.length > 200) {
    return { ok: false, error: ADMIN_ERROR_MESSAGES.password };
  }
  if (!displayName || displayName.length > 80) {
    return { ok: false, error: ADMIN_ERROR_MESSAGES.name };
  }
  return { ok: true, email, password, displayName };
}

export type OperatorBootstrap =
  | { mode: "closed" }
  | { mode: "local" }
  | { mode: "key" }
  | { mode: "unconfigured"; reason: "service" | "schema" | "key" };

/**
 * The first operator can be created only while the roster is empty.
 * Localhost is open. Production requires PLATFORM_ADMIN_SETUP_KEY.
 */
export function canCreateFirstOperator(input: {
  existing: number;
  local: boolean;
  setupKey: string;
  configuredKey: string | undefined;
}): boolean {
  if (input.existing > 0) return false;
  if (input.local) return true;
  return setupKeyMatches(input.setupKey, input.configuredKey);
}
