import { describe, expect, it } from "vitest";
import { AUTH_ERROR_MESSAGES, mapAuthError } from "@/lib/auth-errors";

describe("mapAuthError", () => {
  it("maps email already registered", () => {
    expect(
      mapAuthError(
        { message: "User already registered", code: "user_already_exists" },
        "SIGN_UP_FAILED",
      ),
    ).toBe(AUTH_ERROR_MESSAGES.EMAIL_TAKEN);
  });

  it("maps database errors from profile trigger failures", () => {
    expect(
      mapAuthError(
        { message: "Database error saving new user" },
        "SIGN_UP_FAILED",
      ),
    ).toBe(AUTH_ERROR_MESSAGES.DATABASE_ERROR);
  });

  it("maps email rate limit exceeded", () => {
    expect(
      mapAuthError({ message: "email rate limit exceeded" }, "SIGN_UP_FAILED"),
    ).toBe(AUTH_ERROR_MESSAGES.RATE_LIMITED);
  });
});
