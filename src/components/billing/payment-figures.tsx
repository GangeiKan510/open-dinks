import { formatPaymentAmount } from "@/lib/payment-history";

export function PaymentFigures({
  dueCentavos,
  listCentavos,
  discountCode,
}: {
  dueCentavos: number;
  listCentavos: number | null;
  discountCode: string | null;
}) {
  const discounted =
    listCentavos != null && discountCode != null && listCentavos > dueCentavos;
  if (!discounted || listCentavos == null || discountCode == null) {
    return (
      <p className="font-medium tabular-nums">
        {formatPaymentAmount(dueCentavos)}
      </p>
    );
  }

  return (
    <div className="text-right text-sm">
      <p className="text-[var(--muted)] line-through tabular-nums">
        {formatPaymentAmount(listCentavos)}
      </p>
      <p className="text-emerald-200 tabular-nums">
        {discountCode} · −{formatPaymentAmount(listCentavos - dueCentavos)}
      </p>
      <p className="font-medium tabular-nums">
        {formatPaymentAmount(dueCentavos)}
      </p>
    </div>
  );
}
