import { loadSales } from "@/lib/admin-server";
import {
  formatCentavos,
  paymentAmountCentavos,
  saleKindLabel,
} from "@/lib/admin-sales";
import { formatAdminWhen } from "@/lib/admin-activity";
import { AdminStat, PanelHeading, PanelNote } from "@/components/admin/panel";

export const metadata = { title: "Sales" };

export default async function AdminSalesPage() {
  const sales = await loadSales();
  if (!sales.ok) {
    return (
      <>
        <PanelHeading
          title="Sales"
          body="Club months and tournament days, after a payment is confirmed."
        />
        <PanelNote>{sales.message}</PanelNote>
      </>
    );
  }

  const { summary, recent } = sales.data;
  return (
    <>
      <PanelHeading
        title="Sales"
        body="Club months and tournament days, after a payment is confirmed. Players are not charged."
      />
      <dl className="grid gap-3 sm:grid-cols-3">
        <AdminStat
          label="This month"
          value={formatCentavos(summary.monthCentavos)}
        />
        <AdminStat
          label="All time"
          value={formatCentavos(summary.totalCentavos)}
        />
        <AdminStat
          label="Payments"
          value={String(
            summary.byKind.club.count +
              summary.byKind.day.count +
              summary.byKind.weekend.count,
          )}
        />
      </dl>
      <ul className="grid gap-3 sm:grid-cols-3">
        {(["club", "day", "weekend"] as const).map((kind) => (
          <li
            key={kind}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <p className="text-sm text-[var(--muted)]">{saleKindLabel(kind)}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {formatCentavos(summary.byKind[kind].centavos)}
            </p>
            <p className="text-xs text-[var(--muted)]">
              {summary.byKind[kind].count} payments
            </p>
          </li>
        ))}
      </ul>
      {recent.length === 0 ? (
        <PanelNote>No payments yet.</PanelNote>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-[var(--surface)] text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Club</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((sale) => (
                <tr
                  key={sale.checkoutId}
                  className="border-t border-[var(--border)]"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatAdminWhen(sale.createdAt)}
                  </td>
                  <td className="px-4 py-3">{sale.facilityName}</td>
                  <td className="px-4 py-3">{saleKindLabel(sale.kind)}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatCentavos(paymentAmountCentavos(sale))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
