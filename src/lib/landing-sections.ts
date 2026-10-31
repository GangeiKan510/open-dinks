export const LANDING_SECTIONS = [
  { id: "open-play", label: "Open Play OS" },
  { id: "tournament", label: "Tournament Mode" },
  { id: "court-rentals", label: "Court Rentals and Coaching" },
] as const;

export type LandingSectionId = (typeof LANDING_SECTIONS)[number]["id"];

/**
 * The section whose top has crossed the sticky bar. At the bottom of the page
 * the last section may never reach that line, so it wins once scrolling stops.
 */
export function activeLandingSection(
  sections: ReadonlyArray<{ id: string; top: number }>,
  offset: number,
  atPageEnd = false,
): string {
  const first = sections[0];
  if (!first) return "";
  if (atPageEnd) return sections[sections.length - 1]?.id ?? first.id;

  let current = first.id;
  for (const section of sections) {
    if (section.top <= offset) current = section.id;
  }
  return current;
}
