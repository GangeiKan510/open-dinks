import { PlanCatalogForm } from "@/components/admin/plan-catalog-form";
import { PanelHeading } from "@/components/admin/panel";
import { loadPlanCatalog } from "@/lib/platform-catalog-server";

export const metadata = { title: "Plans" };

export default async function AdminPlansPage() {
  const catalog = await loadPlanCatalog();

  return (
    <>
      <PanelHeading
        title="Plans"
        body="Set what a club month and a tournament day cost, and which features clubs can see."
      />
      <section className="max-w-xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <PlanCatalogForm catalog={catalog} />
      </section>
    </>
  );
}
