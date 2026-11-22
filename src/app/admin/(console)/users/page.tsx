import { formatAdminWhen } from "@/lib/admin-activity";
import { loadRoster } from "@/lib/admin-server";
import { PanelHeading, PanelNote } from "@/components/admin/panel";
import type { AccountKind } from "@/lib/admin-roster";

export const metadata = { title: "Accounts" };

const KIND_LABEL: Record<AccountKind, string> = {
  operator: "Operator",
  host: "Host",
  player: "Player",
  account: "No club yet",
};

export default async function AdminUsersPage() {
  const roster = await loadRoster();
  return (
    <>
      <PanelHeading
        title="Accounts"
        body="Hosts, players, and operator logins. A plan is the club month or trial on that venue."
      />
      {!roster.ok ? <PanelNote>{roster.message}</PanelNote> : null}
      {roster.ok && roster.data.note ? (
        <PanelNote>{roster.data.note}</PanelNote>
      ) : null}
      {roster.ok && roster.data.rows.length === 0 ? (
        <PanelNote>No accounts yet.</PanelNote>
      ) : null}
      {roster.ok && roster.data.rows.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="bg-[var(--surface)] text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Kind</th>
                <th className="px-4 py-3 font-medium">Venues</th>
                <th className="px-4 py-3 font-medium">Last sign-in</th>
              </tr>
            </thead>
            <tbody>
              {roster.data.rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-[var(--border)] align-top"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.displayName}</p>
                    <p className="text-xs text-[var(--muted)]">
                      Joined {formatAdminWhen(row.createdAt)}
                    </p>
                  </td>
                  <td className="px-4 py-3">{row.email || "—"}</td>
                  <td className="px-4 py-3">{KIND_LABEL[row.kind]}</td>
                  <td className="px-4 py-3">
                    {row.venues.length === 0
                      ? "—"
                      : row.venues.map((venue) => (
                          <p key={`${row.id}-${venue.name}-${venue.role}`}>
                            {venue.name} · {venue.role} · {venue.plan}
                          </p>
                        ))}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatAdminWhen(row.lastSignInAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
