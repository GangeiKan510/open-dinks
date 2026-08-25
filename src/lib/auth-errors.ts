/** Stable host-facing auth errors (never return raw provider messages). */
export const AUTH_ERROR_MESSAGES = {
  EMAIL_REQUIRED: "Email is required.",
  PASSWORD_REQUIRED: "Password is required.",
  PASSWORD_TOO_SHORT: "Password must be at least 8 characters.",
  INVALID_CREDENTIALS: "Invalid email or password.",
  EMAIL_TAKEN: "An account with this email already exists. Sign in instead.",
  WEAK_PASSWORD: "Password is too weak. Use at least 8 characters.",
  SIGNUP_DISABLED: "Account creation is disabled for this project.",
  RATE_LIMITED:
    "Email rate limit hit. Wait a few minutes, or disable Confirm email in Supabase Auth for local testing.",
  CONFIRM_EMAIL: "Check your email to confirm your account, then sign in here.",
  SIGN_IN_FAILED: "Could not sign in. Try again.",
  SIGN_UP_FAILED: "Could not create account. Try again.",
  DATABASE_ERROR:
    "Account could not be saved. Apply the latest Supabase migrations and try again.",
} as const;

export type AuthErrorCode = keyof typeof AUTH_ERROR_MESSAGES;

/** Map Supabase Auth errors to stable UI copy. */
export function mapAuthError(
  error:
    { message?: string; code?: string; status?: number } | null | undefined,
  fallback: AuthErrorCode,
): string {
  if (!error) return AUTH_ERROR_MESSAGES[fallback];

  const message = (error.message ?? "").toLowerCase();
  const code = (error.code ?? "").toLowerCase();

  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    message.includes("already registered") ||
    message.includes("already been registered") ||
    message.includes("user already exists")
  ) {
    return AUTH_ERROR_MESSAGES.EMAIL_TAKEN;
  }

  if (
    code === "weak_password" ||
    (message.includes("password") && message.includes("weak"))
  ) {
    return AUTH_ERROR_MESSAGES.WEAK_PASSWORD;
  }

  if (
    code === "signup_disabled" ||
    message.includes("signups not allowed") ||
    message.includes("signup is disabled")
  ) {
    return AUTH_ERROR_MESSAGES.SIGNUP_DISABLED;
  }

  if (
    code === "over_email_send_rate_limit" ||
    message.includes("rate limit") ||
    message.includes("email rate limit") ||
    message.includes("too many requests")
  ) {
    return AUTH_ERROR_MESSAGES.RATE_LIMITED;
  }

  if (
    message.includes("database error") ||
    message.includes("database error saving new user") ||
    code === "unexpected_failure"
  ) {
    return AUTH_ERROR_MESSAGES.DATABASE_ERROR;
  }

  if (
    code === "invalid_credentials" ||
    message.includes("invalid login") ||
    message.includes("invalid credentials")
  ) {
    return AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS;
  }

  return AUTH_ERROR_MESSAGES[fallback];
}
