export const LANDING_SECTIONS = [
  { id: "open-play", label: "Open Play OS" },
  { id: "tournament", label: "Tournament Mode" },
  { id: "court-rentals", label: "Court Rentals and Coaching" },
  { id: "pricing", label: "Pricing" },
  { id: "reviews", label: "Reviews" },
] as const;

export type LandingSectionId = (typeof LANDING_SECTIONS)[number]["id"];

/** Reviews stays in the catalog, and drops from the nav until one is featured. */
export function visibleLandingSections(showReviews: boolean) {
  if (showReviews) return LANDING_SECTIONS;
  return LANDING_SECTIONS.filter((section) => section.id !== "reviews");
}

/**
 * The section whose top has reached the sticky bar. A few pixels of slack
 * cover subpixel alignment when a hash link stops just under that bar. At the
 * bottom of the page the last section wins once scrolling stops.
 */
export function activeLandingSection(
  sections: ReadonlyArray<{ id: string; top: number }>,
  offset: number,
  atPageEnd = false,
): string {
  const first = sections[0];
  if (!first) return "";
  if (atPageEnd) return sections[sections.length - 1]?.id ?? first.id;

  const line = offset + 8;
  let current = first.id;
  for (const section of sections) {
    if (section.top <= line) current = section.id;
  }
  return current;
}
