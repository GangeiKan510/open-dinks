import { isCalendarDate } from "@/lib/entitlements";

/** PayMongo will not create a payment below ₱20. */
export const PAYMONGO_MIN_CENTAVOS = 2_000;

export const DISCOUNT_CODE_MESSAGE =
  "That discount code can't be used for this purchase.";

export const DISCOUNT_ADMIN_MESSAGES = {
  code: "Use 3 to 24 letters, numbers, or hyphens.",
  applies: "Choose where this code can be used.",
  percent: "Enter a percent from 1 to 99.",
  amount: "Enter a whole peso amount.",
  expires: "Enter a real expiry date, or leave it blank.",
  max: "Enter a use limit, or leave it blank.",
  exists: "That code already exists.",
  save: "Could not save that code. Try again.",
} as const;

export type DiscountProduct = "club" | "day";
export type DiscountAppliesTo = DiscountProduct | "any";

export type DiscountOffer = {
  id: string;
  code: string;
  appliesTo: DiscountAppliesTo;
  percentOff: number | null;
  amountOffCentavos: number | null;
  active: boolean;
  expiresOn: string | null;
  maxRedemptions: number | null;
  redemptionCount: number;
};

export type DiscountDraft = {
  code: string;
  appliesTo: DiscountAppliesTo;
  percentOff: number | null;
  amountOffCentavos: number | null;
  expiresOn: string | null;
  maxRedemptions: number | null;
};

/** Blank input is no code. Anything else must be a usable code. */
export function normalizeDiscountCode(value: string): string | null {
  const code = value.trim().toUpperCase();
  if (!code) return null;
  if (!/^[A-Z0-9][A-Z0-9-]{2,23}$/.test(code)) return null;
  return code;
}

export function parseDiscountDraft(input: {
  code: unknown;
  appliesTo: unknown;
  mode: unknown;
  value: unknown;
  expiresOn: unknown;
  maxRedemptions: unknown;
}): { ok: true; draft: DiscountDraft } | { ok: false; error: string } {
  const code = normalizeDiscountCode(String(input.code ?? ""));
  if (!code) return { ok: false, error: DISCOUNT_ADMIN_MESSAGES.code };
  if (
    input.appliesTo !== "club" &&
    input.appliesTo !== "day" &&
    input.appliesTo !== "any"
  ) {
    return { ok: false, error: DISCOUNT_ADMIN_MESSAGES.applies };
  }

  const rawValue = String(input.value ?? "").trim();
  if (!/^\d+$/.test(rawValue)) {
    return {
      ok: false,
      error:
        input.mode === "amount"
          ? DISCOUNT_ADMIN_MESSAGES.amount
          : DISCOUNT_ADMIN_MESSAGES.percent,
    };
  }
  const value = Number(rawValue);
  let percentOff: number | null = null;
  let amountOffCentavos: number | null = null;
  if (input.mode === "percent") {
    if (value < 1 || value > 99) {
      return { ok: false, error: DISCOUNT_ADMIN_MESSAGES.percent };
    }
    percentOff = value;
  } else if (input.mode === "amount") {
    if (value < 1 || value > 100_000) {
      return { ok: false, error: DISCOUNT_ADMIN_MESSAGES.amount };
    }
    amountOffCentavos = value * 100;
  } else {
    return { ok: false, error: DISCOUNT_ADMIN_MESSAGES.percent };
  }

  const expiresRaw = String(input.expiresOn ?? "").trim();
  if (expiresRaw && !isCalendarDate(expiresRaw)) {
    return { ok: false, error: DISCOUNT_ADMIN_MESSAGES.expires };
  }

  const maxRaw = String(input.maxRedemptions ?? "").trim();
  let maxRedemptions: number | null = null;
  if (maxRaw) {
    if (!/^\d+$/.test(maxRaw)) {
      return { ok: false, error: DISCOUNT_ADMIN_MESSAGES.max };
    }
    maxRedemptions = Number(maxRaw);
    if (maxRedemptions < 1 || maxRedemptions > 100_000) {
      return { ok: false, error: DISCOUNT_ADMIN_MESSAGES.max };
    }
  }

  return {
    ok: true,
    draft: {
      code,
      appliesTo: input.appliesTo,
      percentOff,
      amountOffCentavos,
      expiresOn: expiresRaw || null,
      maxRedemptions,
    },
  };
}

/**
 * The price PayMongo should charge. A quoted amount is the discounted total
 * frozen when the checkout was created. No quote means the list price.
 */
export function chargeCentavos(input: {
  listCentavos: number;
  quotedCentavos?: string;
}): number | null {
  if (
    !Number.isSafeInteger(input.listCentavos) ||
    input.listCentavos < PAYMONGO_MIN_CENTAVOS
  ) {
    return null;
  }
  if (!input.quotedCentavos) return input.listCentavos;
  if (!/^\d+$/.test(input.quotedCentavos)) return null;
  const quoted = Number(input.quotedCentavos);
  if (
    !Number.isSafeInteger(quoted) ||
    quoted < PAYMONGO_MIN_CENTAVOS ||
    quoted > input.listCentavos
  ) {
    return null;
  }
  return quoted;
}

export function priceWithDiscount(input: {
  product: DiscountProduct;
  listCentavos: number;
  today: string;
  offer: DiscountOffer;
}): { dueCentavos: number; offCentavos: number } | null {
  if (!input.offer.active) return null;
  if (
    input.offer.appliesTo !== "any" &&
    input.offer.appliesTo !== input.product
  ) {
    return null;
  }
  if (input.offer.expiresOn && input.offer.expiresOn < input.today) return null;
  if (
    input.offer.maxRedemptions != null &&
    input.offer.redemptionCount >= input.offer.maxRedemptions
  ) {
    return null;
  }

  const off =
    input.offer.percentOff != null
      ? Math.round((input.listCentavos * input.offer.percentOff) / 100)
      : input.offer.amountOffCentavos;
  if (off == null || off <= 0) return null;
  const due = input.listCentavos - off;
  if (due < PAYMONGO_MIN_CENTAVOS || due >= input.listCentavos) return null;
  return { dueCentavos: due, offCentavos: off };
}

export function formatCheckoutPesos(centavos: number): string {
  const pesos = centavos / 100;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: centavos % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(pesos);
}

export function discountSummary(input: {
  listCentavos: number;
  dueCentavos: number;
  code: string;
}): string {
  const off = input.listCentavos - input.dueCentavos;
  return `${formatCheckoutPesos(input.listCentavos)} less ${formatCheckoutPesos(off)} with ${input.code}. You pay ${formatCheckoutPesos(input.dueCentavos)}.`;
}

/** PayMongo shows this under the line. The amount field is the price they pay. */
export function checkoutDescription(input: {
  base: string;
  listCentavos: number;
  dueCentavos: number;
  code: string | null;
}): string {
  if (!input.code || input.dueCentavos >= input.listCentavos) return input.base;
  const off = input.listCentavos - input.dueCentavos;
  return `${input.base}. ${formatCheckoutPesos(input.listCentavos)} less ${formatCheckoutPesos(off)} with ${input.code}.`;
}

export function discountOfferLabel(offer: DiscountOffer): string {
  const value =
    offer.percentOff != null
      ? `${offer.percentOff}% off`
      : `${formatCheckoutPesos(offer.amountOffCentavos ?? 0)} off`;
  const where =
    offer.appliesTo === "club"
      ? "Club month"
      : offer.appliesTo === "day"
        ? "Tournament days"
        : "Club and tournament days";
  const uses =
    offer.maxRedemptions == null
      ? `${offer.redemptionCount} used`
      : `${offer.redemptionCount} of ${offer.maxRedemptions} used`;
  const expiry = offer.expiresOn ? ` · until ${offer.expiresOn}` : "";
  const state = offer.active ? "" : " · off";
  return `${offer.code} · ${value} · ${where} · ${uses}${expiry}${state}`;
}
