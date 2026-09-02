"use client";

import type { ReactNode } from "react";
import { CalendarClock, Play, Settings, Users } from "lucide-react";
import {
  Tabs,
  TabsBadge,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export type DashboardTabsProps = {
  pendingRequestCount: number;
  rosterCount: number;
  openPlay: ReactNode;
  bookings: ReactNode;
  roster: ReactNode;
  settings: ReactNode;
};

/**
 * Client shell for the dashboard. Panels are rendered on the server and passed
 * in as slots, so switching tabs is instant and never refetches. Tab state is
 * deliberately local: server actions revalidate the panels around it without
 * resetting which tab the host is on.
 */
export function DashboardTabs({
  pendingRequestCount,
  rosterCount,
  openPlay,
  bookings,
  roster,
  settings,
}: DashboardTabsProps) {
  return (
    <Tabs defaultValue="play">
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
        {bookings}
      </TabsContent>
      <TabsContent value="roster" className="space-y-6">
        {roster}
      </TabsContent>
      <TabsContent value="settings" className="space-y-6">
        {settings}
      </TabsContent>
    </Tabs>
  );
}
