"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { savePlanCatalogAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PLAN_PRICE_MAX_PHP,
  PLAN_PRICE_MIN_PHP,
  type PlanCatalog,
} from "@/lib/platform-catalog";

export function PlanCatalogForm({ catalog }: { catalog: PlanCatalog }) {
  const [pending, startTransition] = useTransition();
  const [clubMonthlyPhp, setClubMonthlyPhp] = useState(
    String(catalog.clubMonthlyPhp),
  );
  const [tournamentDayPhp, setTournamentDayPhp] = useState(
    String(catalog.tournamentDayPhp),
  );
  const [openPlay, setOpenPlay] = useState(catalog.openPlay);
  const [booking, setBooking] = useState(catalog.booking);
  const [tournament, setTournament] = useState(catalog.tournament);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await savePlanCatalogAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Plan settings saved.");
    });
  }

  return (
    <form action={onSubmit} className="space-y-6">
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Prices</legend>
        <p className="text-sm text-[var(--muted)]">
          Whole pesos. The next checkout uses these amounts. A payment already
          sent keeps the price it was quoted at.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="club-monthly-php">Club month</Label>
            <Input
              id="club-monthly-php"
              name="clubMonthlyPhp"
              inputMode="numeric"
              min={PLAN_PRICE_MIN_PHP}
              max={PLAN_PRICE_MAX_PHP}
              required
              value={clubMonthlyPhp}
              onChange={(event) => setClubMonthlyPhp(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tournament-day-php">Tournament day</Label>
            <Input
              id="tournament-day-php"
              name="tournamentDayPhp"
              inputMode="numeric"
              min={PLAN_PRICE_MIN_PHP}
              max={PLAN_PRICE_MAX_PHP}
              required
              value={tournamentDayPhp}
              onChange={(event) => setTournamentDayPhp(event.target.value)}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-lg font-semibold">Shown features</legend>
        <p className="text-sm text-[var(--muted)]">
          A hidden feature leaves the landing page, the host dashboard, and its
          public page. Turn booking on when it is ready to use.
        </p>
        <FeatureToggle
          name="showOpenPlay"
          checked={openPlay}
          onChange={setOpenPlay}
          label="Open play"
        />
        <FeatureToggle
          name="showBooking"
          checked={booking}
          onChange={setBooking}
          label="Court bookings and coaching"
        />
        <FeatureToggle
          name="showTournament"
          checked={tournament}
          onChange={setTournament}
          label="Tournament mode"
        />
      </fieldset>

      <Button type="submit" loading={pending}>
        Save plan settings
      </Button>
    </form>
  );
}

function FeatureToggle({
  name,
  checked,
  onChange,
  label,
}: {
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        value="1"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-[var(--border)]"
      />
      {label}
    </label>
  );
}
