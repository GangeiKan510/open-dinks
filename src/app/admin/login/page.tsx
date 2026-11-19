import type { Metadata } from "next";
import { OperatorLogin } from "@/components/admin/operator-login";
import { loadOperatorBootstrap } from "@/lib/admin-server";

export const metadata: Metadata = {
  title: "Operator login",
  robots: { index: false, follow: false },
};

export default async function OperatorLoginPage() {
  const bootstrap = await loadOperatorBootstrap();
  return <OperatorLogin bootstrap={bootstrap} />;
}
