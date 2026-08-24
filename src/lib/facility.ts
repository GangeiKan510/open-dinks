/** Product name — always present; facilities co-brand when known. */
export const PRODUCT_NAME = "Open Dinks";

export type FacilityConfig = {
  id: string;
  slug: string;
  /** Display name, e.g. "The PickleGrounds". */
  name: string;
  /** Short label for tight UI. */
  shortName: string;
  /** Facility-specific tagline. */
  tagline: string;
};

export type FacilityRow = {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  tagline: string;
};

export function facilityFromRow(row: FacilityRow): FacilityConfig {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.short_name,
    tagline: row.tagline,
  };
}

/** Co-branded lockup when a facility is known; otherwise just Open Dinks. */
export function formatBrandTitle(facility?: FacilityConfig | null): string {
  if (!facility?.name?.trim()) return PRODUCT_NAME;
  return `${PRODUCT_NAME} | ${facility.name.trim()}`;
}

/** Document / browser title, optionally with a page segment. */
export function formatDocumentTitle(
  page?: string,
  facility?: FacilityConfig | null,
): string {
  const brand = formatBrandTitle(facility);
  if (!page?.trim()) return brand;
  return `${page.trim()} · ${brand}`;
}

export function slugifyFacilityName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
  return slug || `facility-${Math.random().toString(36).slice(2, 8)}`;
}
