"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PendingLink } from "@/components/pending-link";
import { Button } from "@/components/ui/button";
import { PRODUCT_NAME } from "@/lib/facility";
import {
  activeLandingSection,
  visibleLandingSections,
  type LandingSectionId,
} from "@/lib/landing-sections";
import { cn } from "@/lib/utils";

export function LandingNav({
  ctaHref,
  ctaLabel,
  showReviews,
  showOpenPlay,
  showBooking,
  showTournament,
}: {
  ctaHref: string;
  ctaLabel: string;
  showReviews: boolean;
  showOpenPlay: boolean;
  showBooking: boolean;
  showTournament: boolean;
}) {
  const headerRef = useRef<HTMLElement>(null);
  const sections = useMemo(
    () =>
      visibleLandingSections({
        reviews: showReviews,
        openPlay: showOpenPlay,
        booking: showBooking,
        tournament: showTournament,
      }),
    [showReviews, showOpenPlay, showBooking, showTournament],
  );
  const [active, setActive] = useState<LandingSectionId>(sections[0].id);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    let frame = 0;
    const read = () => {
      frame = 0;
      const offset = header.offsetHeight + 1;
      const tops = sections.flatMap((section) => {
        const node = document.getElementById(section.id);
        if (!node) return [];
        return [{ id: section.id, top: node.getBoundingClientRect().top }];
      });
      const atPageEnd =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2;
      const next = sections.find(
        (section) =>
          section.id === activeLandingSection(tops, offset, atPageEnd),
      );
      if (next) {
        setActive((current) => (current === next.id ? current : next.id));
      }
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(read);
    };

    read();
    const observer = new ResizeObserver(schedule);
    observer.observe(document.documentElement);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", schedule);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [sections]);

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
          <Link href="/" className="shrink-0">
            <span className="brand-mark brand-mark-nav" aria-hidden="true" />
            <span className="sr-only">{PRODUCT_NAME}</span>
          </Link>
          <Button asChild className="rounded-full md:hidden">
            <PendingLink href={ctaHref}>{ctaLabel}</PendingLink>
          </Button>
        </div>

        <nav
          aria-label="On this page"
          className="flex min-w-0 flex-wrap gap-x-5 md:flex-1 md:flex-nowrap"
        >
          {sections.map((section) => {
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
