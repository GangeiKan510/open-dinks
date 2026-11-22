"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createCoalescedAsync } from "@/lib/coalesce-async";
import {
  BILLING_REALTIME_TABLES,
  isFacilityBillingEvent,
} from "@/lib/billing-realtime";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

const FACILITY_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** How often to re-read the plan while a receipt is waiting to be checked. */
const PLAN_RECHECK_MS = 3000;

/**
 * Reloads the host dashboard when billing changes, so an approved receipt
 * closes the plan dialog without a manual refresh.
 */
export function BillingLive({
  facilityId,
  recheck,
}: {
  facilityId: string;
  recheck: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured() || !FACILITY_ID.test(facilityId)) return;
    const supabase = createClient();
    const schedule = createCoalescedAsync(async () => {
      router.refresh();
    }, 150);
    let channel = supabase.channel(`billing:${facilityId}`);
    for (const table of BILLING_REALTIME_TABLES) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `facility_id=eq.${facilityId}`,
        },
        (payload) => {
          if (
            !isFacilityBillingEvent(
              {
                new: payload.new as Record<string, unknown> | undefined,
                old: payload.old as Record<string, unknown> | undefined,
              },
              facilityId,
            )
          ) {
            return;
          }
          void schedule();
        },
      );
    }
    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [facilityId, router]);

  useEffect(() => {
    if (!recheck) return;
    const timer = setInterval(() => {
      router.refresh();
    }, PLAN_RECHECK_MS);
    return () => clearInterval(timer);
  }, [recheck, router]);

  return null;
}
