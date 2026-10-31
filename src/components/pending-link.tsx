"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useLinkStatus } from "next/link";
import { forwardRef, type ComponentProps, type ReactNode } from "react";

function PendingLabel({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus();

  return (
    <span className="inline-flex items-center gap-2" aria-busy={pending}>
      {children}
      {pending ? (
        <>
          <Loader2 className="link-pending-icon h-4 w-4 shrink-0" aria-hidden />
          <span className="sr-only">Loading</span>
        </>
      ) : null}
    </span>
  );
}

export const PendingLink = forwardRef<
  HTMLAnchorElement,
  ComponentProps<typeof Link>
>(function PendingLink({ children, ...props }, ref) {
  return (
    <Link ref={ref} {...props}>
      <PendingLabel>{children}</PendingLabel>
    </Link>
  );
});
