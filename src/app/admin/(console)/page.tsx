import Link from "next/link";
import {
  activityItems,
  loadActivity,
  loadFeedbackInbox,
  loadRoster,
  loadSales,
} from "@/lib/admin-server";
import { formatCentavos } from "@/lib/admin-sales";
import { AdminStat, PanelHeading, PanelNote } from "@/components/admin/panel";

export default async function AdminOverviewPage() {
  const [sales, roster, activity, feedback] = await Promise.all([
    loadSales(),
    loadRoster(),
    loadActivity(),
    loadFeedbackInbox(),
  ]);
  const recent = activity.ok ? activityItems(activity.data, 6) : [];
  const waiting = feedback.ok
    ? feedback.data.notes.filter((note) => !note.featured).length
    : null;

  return (
    <>
      <PanelHeading
        title="Overview"
        body="Sales, club accounts, and anonymous notes. This login cannot open a host dashboard."
      />
      <dl className="grid gap-3 sm:grid-cols-3">
        <AdminStat
          label="This month"
          value={
            sales.ok ? formatCentavos(sales.data.summary.monthCentavos) : "—"
          }
        />
        <AdminStat
          label="Accounts"
          value={roster.ok ? String(roster.data.rows.length) : "—"}
        />
        <AdminStat
          label="Notes to review"
          value={waiting == null ? "—" : String(waiting)}
        />
      </dl>
      {!sales.ok ? <PanelNote>{sales.message}</PanelNote> : null}
      {!roster.ok ? <PanelNote>{roster.message}</PanelNote> : null}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Latest activity</h2>
          <Link href="/admin/activity" className="text-sm text-[var(--accent)]">
            See all
          </Link>
        </div>
        {!activity.ok ? <PanelNote>{activity.message}</PanelNote> : null}
        {activity.ok && recent.length === 0 ? (
          <PanelNote>Nothing has happened yet.</PanelNote>
        ) : null}
        {recent.length > 0 ? (
          <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            {recent.map((item) => (
              <li key={item.id} className="px-4 py-3">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-sm text-[var(--muted)]">{item.detail}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </>
  );
}
