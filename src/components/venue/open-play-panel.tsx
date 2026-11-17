"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  Tabs,
  TabsBadge,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const PANEL =
  "rounded-xl border border-[var(--border)] bg-[linear-gradient(165deg,color-mix(in_srgb,var(--accent-soft)_55%,var(--surface)),var(--surface))] p-5";

export type PastOpenPlaySession = {
  id: string;
  title: string;
  publicToken: string;
};

export function OpenPlayPanel({
  startLabel,
  start,
  sessions,
}: {
  startLabel: string;
  start: ReactNode;
  sessions: PastOpenPlaySession[];
}) {
  const [tab, setTab] = useState("start");

  return (
    <section className={PANEL}>
      <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-[var(--highlight)]">
        Open play
      </p>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Open play">
          <TabsTrigger value="start">{startLabel}</TabsTrigger>
          <TabsTrigger value="past">
            Past sessions
            <TabsBadge count={sessions.length} />
          </TabsTrigger>
        </TabsList>
        <TabsContent value="start" className="mt-4">
          {start}
        </TabsContent>
        <TabsContent value="past" className="mt-4 space-y-3">
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={`/s/${session.publicToken}/host`}
              className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm transition-colors hover:border-[var(--highlight)]/50 hover:bg-[var(--accent-soft)]"
            >
              <span>{session.title}</span>
              <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--muted)]">
                Completed
              </span>
            </Link>
          ))}
          {sessions.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No past sessions yet.</p>
          ) : null}
        </TabsContent>
      </Tabs>
    </section>
  );
}
