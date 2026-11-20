import type { Metadata } from "next";
import { PRODUCT_NAME } from "@/lib/facility";

/** Homepage title. Other pages keep the short "Page · Picklrz" template. */
export const SITE_TITLE = "Picklrz — open play, tournaments, and court hours";

export const SITE_DESCRIPTION =
  "Picklrz is pickleball software for clubs: fair open-play queues, tournament draws, and court-hour requests, on the phone and the gym TV.";

/** Signed-in and token pages. Crawlers may fetch them, then drop them. */
export const PRIVATE_ROBOTS = {
  index: false,
  follow: false,
} as const satisfies NonNullable<Metadata["robots"]>;

export function siteJsonLd(url: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: PRODUCT_NAME,
        url,
        description: SITE_DESCRIPTION,
      },
      {
        "@type": "SoftwareApplication",
        name: PRODUCT_NAME,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url,
        description: SITE_DESCRIPTION,
      },
    ],
  };
}

/** JSON-LD safe to drop into a script tag. `<` cannot close the script. */
export function jsonLdScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
