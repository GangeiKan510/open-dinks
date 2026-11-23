"use client";

import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import { CalendarClock, Play, Settings } from "lucide-react";
import {
  Tabs,
  TabsBadge,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { BookingsManagerProps } from "@/components/venue/bookings-manager";
import type { FacilitySettingsProps } from "@/components/venue/facility-settings";

const BookingsManager = dynamic(
  () =>
    import("@/components/venue/bookings-manager").then(
      (mod) => mod.BookingsManager,
    ),
  {
    loading: () => (
      <p className="text-sm text-[var(--muted)]">Loading bookings…</p>
    ),
  },
);

const FacilitySettings = dynamic(
  () =>
    import("@/components/venue/facility-settings").then(
      (mod) => mod.FacilitySettings,
    ),
  {
    loading: () => (
      <p className="text-sm text-[var(--muted)]">Loading settings…</p>
    ),
  },
);

type SettingsSection = "subscription" | "payments" | "general";

const SETTINGS_SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: "subscription", label: "Subscription details" },
  { id: "payments", label: "Payment History" },
  { id: "general", label: "General" },
];

export type DashboardTabsProps = {
  showOpenPlay: boolean;
  showBooking: boolean;
  pendingRequestCount: number;
  openPlay: ReactNode;
  bookings: BookingsManagerProps;
  subscription: ReactNode;
  payments: ReactNode;
  pendingPaymentCount: number;
  settings: FacilitySettingsProps | null;
  settingsFallback?: ReactNode;
};

/**
 * Client shell for the dashboard. Open play stays a server slot.
 * Bookings and general settings JS loads the first time those views open.
 * Tab state is local so server-action revalidation does not reset it.
 */
export function DashboardTabs({
  showOpenPlay,
  showBooking,
  pendingRequestCount,
  openPlay,
  bookings,
  subscription,
  payments,
  pendingPaymentCount,
  settings,
  settingsFallback,
}: DashboardTabsProps) {
  const [tab, setTab] = useState(
    showOpenPlay ? "play" : showBooking ? "bookings" : "settings",
  );
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>("general");

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList aria-label="Facility sections">
        {showOpenPlay ? (
          <TabsTrigger value="play">
            <Play className="h-4 w-4 shrink-0" aria-hidden />
            Open play
          </TabsTrigger>
        ) : null}
        {showBooking ? (
          <TabsTrigger value="bookings">
            <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
            Bookings
            <TabsBadge count={pendingRequestCount} tone="attention" />
          </TabsTrigger>
        ) : null}
        <TabsTrigger value="settings">
          <Settings className="h-4 w-4 shrink-0" aria-hidden />
          Settings
          <TabsBadge count={pendingPaymentCount} tone="attention" />
        </TabsTrigger>
      </TabsList>

      {showOpenPlay ? (
        <TabsContent value="play" className="space-y-6">
          {openPlay}
        </TabsContent>
      ) : null}
      {showBooking ? (
        <TabsContent value="bookings" className="space-y-6">
          {tab === "bookings" ? <BookingsManager {...bookings} /> : null}
        </TabsContent>
      ) : null}
      <TabsContent value="settings">
        <div className="grid items-start gap-4 md:grid-cols-[13.5rem_minmax(0,1fr)] md:gap-6">
          <nav
            aria-label="Settings sections"
            className="flex gap-1 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1 md:flex-col"
          >
            {SETTINGS_SECTIONS.map((section) => {
              const selected = settingsSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  aria-current={selected ? "page" : undefined}
                  onClick={() => setSettingsSection(section.id)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium whitespace-nowrap md:w-full",
                    selected
                      ? "bg-[var(--accent)] text-[var(--accent-fg)] shadow-sm"
                      : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]",
                  )}
                >
                  <span className="min-w-0 flex-1">{section.label}</span>
                  {section.id === "payments" ? (
                    <TabsBadge count={pendingPaymentCount} tone="attention" />
                  ) : null}
                </button>
              );
            })}
          </nav>
          <div className="min-w-0">
            {settingsSection === "subscription" ? (
              <div className="space-y-4">
                <h2 className="font-semibold">Subscription details</h2>
                {subscription}
              </div>
            ) : null}
            {settingsSection === "payments" ? payments : null}
            {settingsSection === "general" && tab === "settings" ? (
              settings ? (
                <FacilitySettings {...settings} />
              ) : (
                (settingsFallback ?? null)
              )
            ) : null}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
