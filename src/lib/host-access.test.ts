import { describe, expect, it } from "vitest";
import { canOpenHostDashboard, isPublicBooker } from "./host-access";

describe("isPublicBooker", () => {
  it("treats a Google-only booking sign-in as a booker", () => {
    expect(
      isPublicBooker({
        app_metadata: { provider: "google", providers: ["google"] },
        identities: [{ provider: "google" }],
      }),
    ).toBe(true);
  });

  it("treats an email host as a host", () => {
    expect(
      isPublicBooker({
        app_metadata: { provider: "email", providers: ["email"] },
      }),
    ).toBe(false);
  });

  it("keeps a host who also linked Google", () => {
    expect(
      isPublicBooker({
        app_metadata: { provider: "google", providers: ["email", "google"] },
      }),
    ).toBe(false);
  });

  it("does not guess a booker when the provider is missing", () => {
    expect(isPublicBooker({})).toBe(false);
  });
});

describe("canOpenHostDashboard", () => {
  it("lets a facility member open the dashboard", () => {
    expect(canOpenHostDashboard({ isPublicBooker: true, hasVenue: true })).toBe(
      true,
    );
  });

  it("lets an email host set up their first facility", () => {
    expect(
      canOpenHostDashboard({ isPublicBooker: false, hasVenue: false }),
    ).toBe(true);
  });

  it("keeps a booking account off the dashboard", () => {
    expect(
      canOpenHostDashboard({ isPublicBooker: true, hasVenue: false }),
    ).toBe(false);
  });
});
