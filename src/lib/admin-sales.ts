import {
  CLUB_PRICE_CENTAVOS,
  TOURNAMENT_DAY_CENTAVOS,
  TOURNAMENT_WEEKEND_CENTAVOS,
  formatPeso,
  localDateISO,
} from "@/lib/entitlements";

export type SaleKind = "club" | "day" | "weekend";

export type SaleRecord = {
  checkoutId: string;
  facilityName: string;
  kind: SaleKind;
  amountCentavos: number | null;
  createdAt: string;
};

export type SalesSummary = {
  totalCentavos: number;
  monthCentavos: number;
  byKind: Record<SaleKind, { count: number; centavos: number }>;
};

const KIND_CENTAVOS: Record<SaleKind, number> = {
  club: CLUB_PRICE_CENTAVOS,
  day: TOURNAMENT_DAY_CENTAVOS,
  weekend: TOURNAMENT_WEEKEND_CENTAVOS,
};

export function catalogCentavos(kind: SaleKind): number {
  return KIND_CENTAVOS[kind];
}

/** Stored centavos win. Older rows fall back to the catalog price for that kind. */
export function paymentAmountCentavos(sale: {
  kind: SaleKind;
  amountCentavos: number | null;
}): number {
  if (
    typeof sale.amountCentavos === "number" &&
    Number.isFinite(sale.amountCentavos) &&
    sale.amountCentavos >= 0
  ) {
    return sale.amountCentavos;
  }
  return catalogCentavos(sale.kind);
}

export function formatCentavos(centavos: number): string {
  return formatPeso(Math.round(centavos / 100));
}

export function saleKindLabel(kind: SaleKind): string {
  if (kind === "club") return "Club month";
  if (kind === "day") return "Tournament day";
  return "Four tournament days";
}

export function summarizeSales(
  sales: SaleRecord[],
  now: Date,
  timeZone = "Asia/Manila",
): SalesSummary {
  const month = localDateISO(timeZone, now).slice(0, 7);
  const summary: SalesSummary = {
    totalCentavos: 0,
    monthCentavos: 0,
    byKind: {
      club: { count: 0, centavos: 0 },
      day: { count: 0, centavos: 0 },
      weekend: { count: 0, centavos: 0 },
    },
  };

  for (const sale of sales) {
    const amount = paymentAmountCentavos(sale);
    const created = new Date(sale.createdAt);
    summary.totalCentavos += amount;
    summary.byKind[sale.kind].count += 1;
    summary.byKind[sale.kind].centavos += amount;
    if (
      !Number.isNaN(created.getTime()) &&
      localDateISO(timeZone, created).slice(0, 7) === month
    ) {
      summary.monthCentavos += amount;
    }
  }

  return summary;
}
