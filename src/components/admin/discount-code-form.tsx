"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createDiscountCodeAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const APPLIES = [
  { id: "any", label: "Club and tournament" },
  { id: "club", label: "Club month" },
  { id: "day", label: "Tournament days" },
] as const;

export function DiscountCodeForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [appliesTo, setAppliesTo] =
    useState<(typeof APPLIES)[number]["id"]>("any");
  const [mode, setMode] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createDiscountCodeAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCode("");
      setValue("");
      setExpiresOn("");
      setMaxRedemptions("");
      toast.success("Discount code saved.");
      router.refresh();
    });
  }

  return (
    <form className="space-y-4" action={onSubmit}>
      <input type="hidden" name="appliesTo" value={appliesTo} />
      <input type="hidden" name="mode" value={mode} />
      <div className="space-y-1">
        <Label htmlFor="discount-code">Code</Label>
        <Input
          id="discount-code"
          name="code"
          required
          maxLength={24}
          autoComplete="off"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Works on</p>
        <div className="flex flex-wrap gap-2">
          {APPLIES.map((option) => (
            <Button
              key={option.id}
              type="button"
              size="sm"
              variant={appliesTo === option.id ? "default" : "outline"}
              onClick={() => setAppliesTo(option.id)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Discount</p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "percent" ? "default" : "outline"}
            onClick={() => setMode("percent")}
          >
            Percent
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "amount" ? "default" : "outline"}
            onClick={() => setMode("amount")}
          >
            Pesos
          </Button>
        </div>
        <Label htmlFor="discount-value" className={cn("sr-only")}>
          {mode === "percent" ? "Percent off" : "Pesos off"}
        </Label>
        <Input
          id="discount-value"
          name="value"
          inputMode="numeric"
          required
          placeholder={mode === "percent" ? "10" : "100"}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="discount-expires">Expiry</Label>
          <Input
            id="discount-expires"
            name="expiresOn"
            placeholder="YYYY-MM-DD"
            value={expiresOn}
            onChange={(event) => setExpiresOn(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="discount-max">Use limit</Label>
          <Input
            id="discount-max"
            name="maxRedemptions"
            inputMode="numeric"
            placeholder="Unlimited"
            value={maxRedemptions}
            onChange={(event) => setMaxRedemptions(event.target.value)}
          />
        </div>
      </div>
      <Button type="submit" loading={pending}>
        Save code
      </Button>
    </form>
  );
}
