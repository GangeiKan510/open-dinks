"use client";

import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import { CalendarClock, Play, Settings, Users } from "lucide-react";
import {
  Tabs,
  TabsBadge,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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

export type DashboardTabsProps = {
  pendingRequestCount: number;
  rosterCount: number;
  openPlay: ReactNode;
  bookings: BookingsManagerProps;
  roster: ReactNode;
  settings: FacilitySettingsProps | null;
  settingsFallback?: ReactNode;
};

/**
 * Client shell for the dashboard. Open play and roster stay as server slots.
 * Bookings and settings JS loads the first time those tabs are opened.
 * Tab state is local so server-action revalidation does not reset it.
 */
export function DashboardTabs({
  pendingRequestCount,
  rosterCount,
  openPlay,
  bookings,
  roster,
  settings,
  settingsFallback,
}: DashboardTabsProps) {
  const [tab, setTab] = useState("play");

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList aria-label="Facility sections">
        <TabsTrigger value="play">
          <Play className="h-4 w-4 shrink-0" aria-hidden />
          Open play
        </TabsTrigger>
        <TabsTrigger value="bookings">
          <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
          Bookings
          <TabsBadge count={pendingRequestCount} tone="attention" />
        </TabsTrigger>
        <TabsTrigger value="roster">
          <Users className="h-4 w-4 shrink-0" aria-hidden />
          Roster
          <TabsBadge count={rosterCount} />
        </TabsTrigger>
        <TabsTrigger value="settings">
          <Settings className="h-4 w-4 shrink-0" aria-hidden />
          Settings
        </TabsTrigger>
      </TabsList>

      <TabsContent value="play" className="space-y-6">
        {openPlay}
      </TabsContent>
      <TabsContent value="bookings" className="space-y-6">
        {tab === "bookings" ? <BookingsManager {...bookings} /> : null}
      </TabsContent>
      <TabsContent value="roster" className="space-y-6">
        {roster}
      </TabsContent>
      <TabsContent value="settings" className="space-y-6">
        {tab === "settings" ? (
          settings ? (
            <FacilitySettings {...settings} />
          ) : (
            (settingsFallback ?? null)
          )
        ) : null}
      </TabsContent>
    </Tabs>
  );
}
