import { afterEach, describe, expect, it } from "vitest";
import { siteUrl } from "./env";

const KEYS = [
  "NEXT_PUBLIC_SITE_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL",
] as const;

describe("siteUrl", () => {
  const previous = new Map<string, string | undefined>();

  afterEach(() => {
    for (const key of KEYS) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    previous.clear();
  });

  function setEnv(key: (typeof KEYS)[number], value: string | undefined) {
    if (!previous.has(key)) previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  it("uses the configured public origin", () => {
    setEnv("NEXT_PUBLIC_SITE_URL", "https://picklrz.example/");
    setEnv("VERCEL_PROJECT_PRODUCTION_URL", "ignored.vercel.app");
    expect(siteUrl()).toBe("https://picklrz.example");
  });

  it("prefers the Vercel production domain over a preview host", () => {
    setEnv("NEXT_PUBLIC_SITE_URL", "  ");
    setEnv("VERCEL_PROJECT_PRODUCTION_URL", "picklrz.vercel.app");
    setEnv("VERCEL_URL", "opendinks-git-develop.vercel.app");
    expect(siteUrl()).toBe("https://picklrz.vercel.app");
  });

  it("uses the current deployment when production is unset", () => {
    setEnv("NEXT_PUBLIC_SITE_URL", undefined);
    setEnv("VERCEL_PROJECT_PRODUCTION_URL", undefined);
    setEnv("VERCEL_URL", "https://opendinks-abc.vercel.app/");
    expect(siteUrl()).toBe("https://opendinks-abc.vercel.app");
  });

  it("stays on localhost when no host is configured", () => {
    for (const key of KEYS) setEnv(key, undefined);
    expect(siteUrl()).toBe("http://localhost:3000");
  });
});
