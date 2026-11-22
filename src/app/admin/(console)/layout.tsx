import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireOperator } from "@/lib/admin-server";

export const metadata: Metadata = {
  title: "Operator",
  robots: { index: false, follow: false },
};

export default async function AdminConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gate = await requireOperator();
  if (!gate.ok) {
    redirect(gate.reason === "signed-out" ? "/admin/login" : "/dashboard");
  }
  return <AdminShell email={gate.email}>{children}</AdminShell>;
}
