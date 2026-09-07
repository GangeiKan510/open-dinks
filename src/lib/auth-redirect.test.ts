import { describe, expect, it } from "vitest";
import { publicBookerFromUser, safeAuthNextPath } from "./auth-redirect";

describe("safeAuthNextPath", () => {
  it("keeps relative app paths", () => {
    expect(safeAuthNextPath("/book/riverside")).toBe("/book/riverside");
    expect(safeAuthNextPath("/book/riverside?tab=coaching")).toBe(
      "/book/riverside?tab=coaching",
    );
  });

  it("rejects open redirects", () => {
    expect(safeAuthNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeAuthNextPath("//evil.example")).toBe("/dashboard");
    expect(safeAuthNextPath(null)).toBe("/dashboard");
    expect(safeAuthNextPath("/ok", "/login")).toBe("/ok");
    expect(safeAuthNextPath("//evil", "/login")).toBe("/login");
  });
});

describe("publicBookerFromUser", () => {
  it("prefers Google full_name then email local-part", () => {
    expect(
      publicBookerFromUser({
        id: "u1",
        email: "alex@example.com",
        user_metadata: { full_name: "Alex Rivera" },
      }),
    ).toEqual({
      id: "u1",
      email: "alex@example.com",
      displayName: "Alex Rivera",
    });

    expect(
      publicBookerFromUser({
        id: "u2",
        email: "sam@example.com",
        user_metadata: {},
      }).displayName,
    ).toBe("sam");
  });
});
