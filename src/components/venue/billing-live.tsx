"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { pendingReceiptStampAction } from "@/app/actions/billing";
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
  pendingStamp,
}: {
  facilityId: string;
  recheck: boolean;
  /** Pending receipt ids already rendered. A poll reloads only when this changes. */
  pendingStamp: string;
}) {
  const router = useRouter();
  const pendingStampRef = useRef(pendingStamp);
  const reloading = useRef(false);

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
    pendingStampRef.current = pendingStamp;
    reloading.current = false;
  }, [pendingStamp]);

  useEffect(() => {
    if (!recheck) return;
    let cancelled = false;

    const check = () => {
      if (cancelled || reloading.current) return;
      if (document.visibilityState === "hidden") return;
      void pendingReceiptStampAction().then((next) => {
        if (cancelled || next == null || next === pendingStampRef.current) {
          return;
        }
        reloading.current = true;
        router.refresh();
      });
    };

    const timer = setInterval(check, PLAN_RECHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [recheck, router]);

  return null;
}
