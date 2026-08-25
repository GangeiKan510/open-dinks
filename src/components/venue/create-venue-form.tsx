"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createVenueAction } from "@/app/actions/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_COURT_COUNT,
  MAX_COURT_COUNT,
  MIN_COURT_COUNT,
} from "@/lib/court-count";
import {
  formatBrandTitle,
  PRODUCT_NAME,
  type FacilityConfig,
} from "@/lib/facility";

export function CreateVenueForm({
  facility,
}: {
  facility: FacilityConfig | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [facilityName, setFacilityName] = useState("");
  const [courtCount, setCourtCount] = useState(String(DEFAULT_COURT_COUNT));

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData();
        formData.set("name", name);
        formData.set("facilityName", facilityName);
        formData.set("courtCount", courtCount);

        startTransition(async () => {
          const result = await createVenueAction(formData);
          if ("error" in result) {
            toast.error(result.error);
            return;
          }
          toast.success("Venue created");
          router.push(`/venues/${result.venueId}`);
          router.refresh();
        });
      }}
    >
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="name">Venue name</Label>
        <Input
          id="name"
          name="name"
          required
          placeholder="Riverside Rec"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="facilityName">Facility name</Label>
        {facility ? (
          <p className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm">
            {formatBrandTitle(facility)}
            <span className="mt-1 block text-xs text-[var(--muted)]">
              New venues use your existing facility. Edit branding on a venue
              page.
            </span>
          </p>
        ) : (
          <>
            <Input
              id="facilityName"
              name="facilityName"
              placeholder="The PickleGrounds"
              value={facilityName}
              onChange={(event) => setFacilityName(event.target.value)}
            />
            <p className="text-xs text-[var(--muted)]">
              Co-brands as {PRODUCT_NAME} | {"{"}facility{"}"}. Leave blank to
              use the venue name.
            </p>
          </>
        )}
      </div>
      <div className="w-28 space-y-1">
        <Label htmlFor="courtCount">Courts</Label>
        <Input
          id="courtCount"
          name="courtCount"
          type="number"
          min={MIN_COURT_COUNT}
          max={MAX_COURT_COUNT}
          value={courtCount}
          onChange={(event) => setCourtCount(event.target.value)}
          required
        />
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create"}
        </Button>
      </div>
    </form>
  );
}
