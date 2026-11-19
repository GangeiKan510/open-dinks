"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { OperatorCreateForm } from "@/components/admin/operator-create-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADMIN_ERROR_MESSAGES } from "@/lib/admin-messages";
import { mapAuthError } from "@/lib/auth-errors";
import { PRODUCT_NAME } from "@/lib/facility";
import { createClient } from "@/lib/supabase/client";
import type { OperatorBootstrap } from "@/lib/operator-access";

export function OperatorLogin({ bootstrap }: { bootstrap: OperatorBootstrap }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function onSubmit(formData: FormData) {
    const nextEmail = String(formData.get("email") ?? "").trim();
    const nextPassword = String(formData.get("password") ?? "");
    if (!nextEmail || !nextPassword) {
      toast.error(
        nextEmail ? ADMIN_ERROR_MESSAGES.password : ADMIN_ERROR_MESSAGES.email,
      );
      return;
    }
    startTransition(async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithPassword({
          email: nextEmail,
          password: nextPassword,
        });
        if (error) {
          toast.error(mapAuthError(error, "SIGN_IN_FAILED"));
          return;
        }
        router.push("/admin");
        router.refresh();
      } catch (error) {
        console.error(
          "[admin] sign in failed",
          error instanceof Error ? error.name : "unknown",
        );
        toast.error(mapAuthError(null, "SIGN_IN_FAILED"));
      }
    });
  }

  async function afterCreate(input: { email: string; password: string }) {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(input);
    if (error) {
      toast.error(mapAuthError(error, "SIGN_IN_FAILED"));
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <p className="mb-8 font-[family-name:var(--font-logo)] text-3xl leading-none">
        {PRODUCT_NAME}
      </p>
      <h1 className="mb-2 text-3xl font-semibold">Operator login</h1>
      <p className="mb-6 text-sm leading-relaxed text-[var(--muted)]">
        This account opens the operator panel only. It cannot run open play,
        bookings, or tournaments.
      </p>
      <form
        className="space-y-4"
        action={(formData) => {
          onSubmit(formData);
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <Button className="w-full" loading={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {bootstrap.mode === "local" || bootstrap.mode === "key" ? (
        <section className="mt-10 space-y-4 border-t border-[var(--border)] pt-8">
          <h2 className="text-lg font-semibold">Create the first operator</h2>
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            This is available once, while no operator account exists. The
            account is locked to the operator panel.
          </p>
          <OperatorCreateForm
            setupKey={bootstrap.mode === "key"}
            onCreated={afterCreate}
          />
        </section>
      ) : null}

      {bootstrap.mode === "unconfigured" ? (
        <p className="mt-8 text-sm leading-relaxed text-[var(--muted)]">
          {bootstrap.reason === "service"
            ? ADMIN_ERROR_MESSAGES.unconfigured
            : bootstrap.reason === "schema"
              ? ADMIN_ERROR_MESSAGES.missingSchema
              : "Set PLATFORM_ADMIN_SETUP_KEY on the server, then reload this page to create the first operator account."}
        </p>
      ) : null}
    </main>
  );
}
