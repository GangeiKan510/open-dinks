import { describe, expect, it } from "vitest";
import { ADMIN_ERROR_MESSAGES } from "./admin-messages";
import {
  canCreateFirstOperator,
  isOperatorLoginPath,
  isOperatorRoute,
  operatorMayPass,
  operatorRedirect,
  parseOperatorDraft,
  setupKeyMatches,
} from "./operator-access";

describe("operator routes", () => {
  it("treats the panel as the only operator product", () => {
    expect(isOperatorRoute("/admin")).toBe(true);
    expect(isOperatorRoute("/admin/sales")).toBe(true);
    expect(isOperatorRoute("/admin/login")).toBe(true);
    expect(isOperatorRoute("/dashboard")).toBe(false);
    expect(isOperatorRoute("/administrator")).toBe(false);
    expect(isOperatorLoginPath("/admin/login")).toBe(true);
    expect(isOperatorLoginPath("/admin")).toBe(false);
  });

  it("leaves webhooks, auth callbacks, and crawler files alone", () => {
    expect(operatorMayPass("/api/paymongo/webhook")).toBe(true);
    expect(operatorMayPass("/auth/callback")).toBe(true);
    expect(operatorMayPass("/robots.txt")).toBe(true);
    expect(operatorMayPass("/sitemap.xml")).toBe(true);
    expect(operatorMayPass("/dashboard")).toBe(false);
  });

  it("sends an operator away from host and public routes", () => {
    expect(
      operatorRedirect({
        pathname: "/dashboard",
        isOperator: true,
        signedIn: true,
      }),
    ).toBe("/admin");
    expect(
      operatorRedirect({
        pathname: "/admin/login",
        isOperator: true,
        signedIn: true,
      }),
    ).toBe("/admin");
    expect(
      operatorRedirect({
        pathname: "/admin/sales",
        isOperator: true,
        signedIn: true,
      }),
    ).toBeNull();
  });

  it("keeps hosts and visitors out of the panel", () => {
    expect(
      operatorRedirect({
        pathname: "/admin/users",
        isOperator: false,
        signedIn: true,
      }),
    ).toBe("/dashboard");
    expect(
      operatorRedirect({
        pathname: "/admin",
        isOperator: false,
        signedIn: false,
      }),
    ).toBe("/admin/login");
    expect(
      operatorRedirect({
        pathname: "/admin/login",
        isOperator: false,
        signedIn: false,
      }),
    ).toBeNull();
    expect(
      operatorRedirect({
        pathname: "/dashboard",
        isOperator: false,
        signedIn: true,
      }),
    ).toBeNull();
  });
});

describe("first operator", () => {
  it("accepts a matching setup key and rejects a short or wrong one", () => {
    expect(setupKeyMatches("correct-key", "correct-key")).toBe(true);
    expect(setupKeyMatches("correct-key", "correct-kez")).toBe(false);
    expect(setupKeyMatches("short", "short")).toBe(false);
    expect(setupKeyMatches("", undefined)).toBe(false);
  });

  it("opens localhost until the first operator exists, then closes", () => {
    expect(
      canCreateFirstOperator({
        existing: 0,
        local: true,
        setupKey: "",
        configuredKey: undefined,
      }),
    ).toBe(true);
    expect(
      canCreateFirstOperator({
        existing: 1,
        local: true,
        setupKey: "",
        configuredKey: undefined,
      }),
    ).toBe(false);
  });

  it("rejects a blank operator draft", () => {
    expect(
      parseOperatorDraft({
        email: "not-an-email",
        password: "short",
        displayName: "  ",
      }),
    ).toEqual({ ok: false, error: ADMIN_ERROR_MESSAGES.email });
    expect(
      parseOperatorDraft({
        email: "sean@picklrz.test",
        password: "long-enough",
        displayName: " Sean ",
      }),
    ).toEqual({
      ok: true,
      email: "sean@picklrz.test",
      password: "long-enough",
      displayName: "Sean",
    });
  });

  it("requires the setup key in production", () => {
    expect(
      canCreateFirstOperator({
        existing: 0,
        local: false,
        setupKey: "",
        configuredKey: undefined,
      }),
    ).toBe(false);
    expect(
      canCreateFirstOperator({
        existing: 0,
        local: false,
        setupKey: "wrong-key",
        configuredKey: "correct-key",
      }),
    ).toBe(false);
    expect(
      canCreateFirstOperator({
        existing: 0,
        local: false,
        setupKey: "correct-key",
        configuredKey: "correct-key",
      }),
    ).toBe(true);
  });
});
