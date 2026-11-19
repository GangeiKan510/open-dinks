"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/actions/session";
import { Button } from "@/components/ui/button";
import { PRODUCT_NAME } from "@/lib/facility";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/sales", label: "Sales" },
  { href: "/admin/codes", label: "Discounts" },
  { href: "/admin/users", label: "Accounts" },
  { href: "/admin/activity", label: "Activity" },
  { href: "/admin/feedback", label: "Feedback" },
  { href: "/admin/operators", label: "Operators" },
] as const;

export function AdminShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="page-canvas min-h-screen">
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="font-[family-name:var(--font-logo)] text-2xl leading-none"
            >
              {PRODUCT_NAME}
            </Link>
            <span className="rounded-full border border-[var(--border)] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
              Operator
            </span>
          </div>
          <div className="flex items-center gap-3">
            {email ? (
              <p className="max-w-56 truncate text-sm text-[var(--muted)]">
                {email}
              </p>
            ) : null}
            <form action={signOutAction}>
              <input type="hidden" name="next" value="/admin/login" />
              <Button variant="outline" type="submit" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-8 md:grid-cols-[11rem_minmax(0,1fr)]">
        <nav
          className="flex gap-2 overflow-x-auto md:flex-col"
          aria-label="Operator"
        >
          {LINKS.map((link) => {
            const active =
              "exact" in link
                ? pathname === link.href
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-3 py-2 text-sm whitespace-nowrap",
                  active
                    ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </div>
  );
}
