import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PRIVATE_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Host login",
  robots: PRIVATE_ROBOTS,
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
