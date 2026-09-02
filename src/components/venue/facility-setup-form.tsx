"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createFacilityAction } from "@/app/actions/facility";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_COURT_COUNT,
  MAX_COURT_COUNT,
  MIN_COURT_COUNT,
} from "@/lib/court-count";
import { PRODUCT_NAME } from "@/lib/facility";

export function FacilitySetupForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    formData.set(
      "timezone",
      Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    );
    setError(null);
    startTransition(async () => {
      const result = await createFacilityAction(formData);
      if ("error" in result) {
        setError(result.error);
        toast.error(result.error);
      }
    });
  }

  return (
    <form action={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="facility-name">Facility name</Label>
        <Input
          id="facility-name"
          name="name"
          required
          maxLength={120}
          placeholder="The Picklegrounds"
        />
        <p className="text-xs text-[var(--muted)]">
          Shown on the wallboard as {PRODUCT_NAME} | your facility.
        </p>
      </div>

      <div className="w-28 space-y-1">
        <Label htmlFor="facility-courts">Courts</Label>
        <Input
          id="facility-courts"
          name="courtCount"
          type="number"
          min={MIN_COURT_COUNT}
          max={MAX_COURT_COUNT}
          defaultValue={DEFAULT_COURT_COUNT}
          required
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-700 sm:col-span-2">
          {error}
        </p>
      ) : null}

      <div className="flex items-end">
        <Button type="submit" loading={pending}>
          Create facility
        </Button>
      </div>
    </form>
  );
}
