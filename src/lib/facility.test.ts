import { describe, expect, it } from "vitest";
import {
  facilityFromRow,
  formatBrandTitle,
  formatDocumentTitle,
  PRODUCT_NAME,
  slugifyFacilityName,
} from "@/lib/facility";

describe("facility branding", () => {
  it("uses product name alone when no facility is set", () => {
    expect(formatBrandTitle()).toBe(PRODUCT_NAME);
    expect(formatBrandTitle(null)).toBe(PRODUCT_NAME);
    expect(formatDocumentTitle()).toBe(PRODUCT_NAME);
  });

  it("maps a database facility row into a co-branded title", () => {
    const config = facilityFromRow({
      id: "fac-1",
      slug: "the-picklegrounds",
      name: "The PickleGrounds",
      short_name: "TPG",
      tagline: "Open play at The PickleGrounds",
    });
    expect(config.shortName).toBe("TPG");
    expect(formatBrandTitle(config)).toBe("Open Dinks | The PickleGrounds");
    expect(formatDocumentTitle("Host login", config)).toBe(
      "Host login · Open Dinks | The PickleGrounds",
    );
  });

  it("slugifies facility names for new accounts", () => {
    expect(slugifyFacilityName("The PickleGrounds")).toBe("the-picklegrounds");
  });

  it("keeps Open Dinks as the product name", () => {
    expect(PRODUCT_NAME).toBe("Open Dinks");
  });
});
