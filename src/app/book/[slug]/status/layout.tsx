import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PRIVATE_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  robots: PRIVATE_ROBOTS,
};

export default function BookingStatusLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
