"use client";

import { useEffect, useRef, useState } from "react";
import { PendingLink } from "@/components/pending-link";
import { Button } from "@/components/ui/button";
import { PRODUCT_NAME } from "@/lib/facility";
import {
  LANDING_SECTIONS,
  activeLandingSection,
  type LandingSectionId,
} from "@/lib/landing-sections";
import { cn } from "@/lib/utils";

export function LandingNav({
  ctaHref,
  ctaLabel,
}: {
  ctaHref: string;
  ctaLabel: string;
}) {
  const headerRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState<LandingSectionId>(
    LANDING_SECTIONS[0].id,
  );

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    let frame = 0;
    const read = () => {
      frame = 0;
      const offset = header.offsetHeight + 1;
      const tops = LANDING_SECTIONS.flatMap((section) => {
        const node = document.getElementById(section.id);
        if (!node) return [];
        return [{ id: section.id, top: node.getBoundingClientRect().top }];
      });
      const atPageEnd =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2;
      const next = activeLandingSection(tops, offset, atPageEnd);
      if (
        next === "open-play" ||
        next === "tournament" ||
        next === "court-rentals"
      ) {
        setActive((current) => (current === next ? current : next));
      }
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(read);
    };

    read();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const apply = () => {
      document.documentElement.style.scrollPaddingTop = `${header.offsetHeight}px`;
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(header);
    return () => {
      observer.disconnect();
      document.documentElement.style.scrollPaddingTop = "";
    };
  }, []);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--page-top)]/90 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-3 md:flex-row md:items-center md:gap-8">
        <div className="flex items-center justify-between gap-4">
          <div
            className="brand-mark brand-mark-nav"
            role="img"
            aria-label={PRODUCT_NAME}
          />
          <Button asChild className="rounded-full md:hidden">
            <PendingLink href={ctaHref}>{ctaLabel}</PendingLink>
          </Button>
        </div>

        <nav
          aria-label="On this page"
          className="flex min-w-0 flex-wrap gap-x-5 md:flex-1 md:flex-nowrap"
        >
          {LANDING_SECTIONS.map((section) => {
            const current = active === section.id;
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                aria-current={current ? "location" : undefined}
                className={cn(
                  "shrink-0 border-b-2 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
                  current
                    ? "border-[var(--highlight)] text-[var(--foreground)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                {section.label}
              </a>
            );
          })}
        </nav>

        <Button asChild className="hidden rounded-full md:inline-flex">
          <PendingLink href={ctaHref}>{ctaLabel}</PendingLink>
        </Button>
      </div>
    </header>
  );
}
