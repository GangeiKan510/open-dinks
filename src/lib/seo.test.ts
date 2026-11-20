import { describe, expect, it } from "vitest";
import { PRODUCT_NAME } from "./facility";
import { jsonLdScript, SITE_DESCRIPTION, SITE_TITLE, siteJsonLd } from "./seo";

describe("search metadata", () => {
  it("leads the public title and description with the product name", () => {
    expect(SITE_TITLE.startsWith(PRODUCT_NAME)).toBe(true);
    expect(SITE_DESCRIPTION.startsWith(PRODUCT_NAME)).toBe(true);
    expect(SITE_DESCRIPTION).toContain("pickleball");
    expect(SITE_TITLE.length).toBeLessThanOrEqual(60);
  });

  it("names the site in structured data and keeps script markup closed", () => {
    const script = jsonLdScript(siteJsonLd("https://picklrz.example"));
    expect(script).toContain('"name":"Picklrz"');
    expect(script).toContain("https://picklrz.example");
    expect(script).not.toContain("<");
    expect(jsonLdScript({ note: "</script><script>" })).not.toContain("<");
  });
});
