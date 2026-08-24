"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { signInWithMagicLinkAction } from "@/app/actions/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRODUCT_NAME } from "@/lib/facility";

export default function LoginPage() {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link
        href="/"
        className="mb-8 font-[family-name:var(--font-display)] text-2xl"
      >
        {PRODUCT_NAME}
      </Link>
      <h1 className="mb-2 text-3xl font-semibold">Host login</h1>
      <p className="mb-8 text-[var(--muted)]">
        Magic link sign-in for organizers. Players join sessions via QR — no
        account needed.
      </p>

      {sent ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
          Check your email for the login link. You can close this tab.
        </div>
      ) : (
        <form
          className="space-y-4"
          action={(formData) => {
            startTransition(async () => {
              const result = await signInWithMagicLinkAction(formData);
              if (result && "error" in result && result.error) {
                toast.error(result.error);
                return;
              }
              setSent(true);
              toast.success("Magic link sent");
            });
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@club.com"
            />
          </div>
          <Button className="w-full" disabled={pending}>
            {pending ? "Sending…" : "Email me a link"}
          </Button>
        </form>
      )}

      <p className="mt-8 text-sm text-[var(--muted)]">
        No Supabase yet?{" "}
        <Link href="/demo" className="text-[var(--accent)] underline">
          Try the local demo
        </Link>
        .
      </p>
    </main>
  );
}
