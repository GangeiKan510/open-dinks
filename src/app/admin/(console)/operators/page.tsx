import { OperatorCreateForm } from "@/components/admin/operator-create-form";
import { PanelHeading, PanelNote } from "@/components/admin/panel";
import { loadRoster } from "@/lib/admin-server";

export const metadata = { title: "Operators" };

export default async function AdminOperatorsPage() {
  const roster = await loadRoster();
  const operators = roster.ok
    ? roster.data.rows.filter((row) => row.kind === "operator")
    : [];

  return (
    <>
      <PanelHeading
        title="Operators"
        body="Each account here can open this panel and nothing else. Create another one when someone else should watch sales and feedback."
      />
      {!roster.ok ? <PanelNote>{roster.message}</PanelNote> : null}
      {operators.length > 0 ? (
        <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {operators.map((operator) => (
            <li key={operator.id} className="px-4 py-3">
              <p className="text-sm font-medium">{operator.displayName}</p>
              <p className="text-sm text-[var(--muted)]">
                {operator.email || "No email"}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      <section className="max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="mb-4 text-lg font-semibold">New operator</h2>
        <OperatorCreateForm />
      </section>
    </>
  );
}
