"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_ERROR_MESSAGES, mapAuthError } from "@/lib/auth-errors";
import { PRODUCT_NAME } from "@/lib/facility";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Mode = "sign-in" | "sign-up";

export default function LoginPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  function onSubmit(formData: FormData) {
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email) {
      toast.error(AUTH_ERROR_MESSAGES.EMAIL_REQUIRED);
      return;
    }
    if (!password) {
      toast.error(AUTH_ERROR_MESSAGES.PASSWORD_REQUIRED);
      return;
    }
    if (mode === "sign-up" && password.length < 8) {
      toast.error(AUTH_ERROR_MESSAGES.PASSWORD_TOO_SHORT);
      return;
    }

    startTransition(async () => {
      try {
        const supabase = createClient();

        if (mode === "sign-in") {
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) {
            toast.error(mapAuthError(error, "SIGN_IN_FAILED"));
            return;
          }
          router.push("/dashboard");
          router.refresh();
          return;
        }

        const siteUrl =
          process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
          window.location.origin;

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${siteUrl}/auth/callback`,
          },
        });

        if (error) {
          console.error("[auth] signUp failed", error);
          toast.error(mapAuthError(error, "SIGN_UP_FAILED"));
          return;
        }

        if (data.session) {
          router.push("/dashboard");
          router.refresh();
          return;
        }

        // Email confirmation enabled in the Supabase project.
        setNeedsConfirmation(true);
        toast.success(AUTH_ERROR_MESSAGES.CONFIRM_EMAIL);
      } catch (err) {
        console.error("[auth] unexpected failure", err);
        toast.error(
          mode === "sign-in"
            ? AUTH_ERROR_MESSAGES.SIGN_IN_FAILED
            : AUTH_ERROR_MESSAGES.SIGN_UP_FAILED,
        );
      }
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link
        href="/"
        className="mb-8 font-[family-name:var(--font-display)] text-2xl"
      >
        {PRODUCT_NAME}
      </Link>
      <h1 className="mb-2 text-3xl font-semibold">
        {mode === "sign-in" ? "Host login" : "Create host account"}
      </h1>
      <p className="mb-6 text-[var(--muted)]">
        Email and password for organizers. Players join sessions via QR — no
        account needed.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1">
        <button
          type="button"
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium transition",
            mode === "sign-in"
              ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
              : "text-[var(--muted)]",
          )}
          onClick={() => {
            setMode("sign-in");
            setNeedsConfirmation(false);
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium transition",
            mode === "sign-up"
              ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
              : "text-[var(--muted)]",
          )}
          onClick={() => {
            setMode("sign-up");
            setNeedsConfirmation(false);
          }}
        >
          Create account
        </button>
      </div>

      {needsConfirmation ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
          {AUTH_ERROR_MESSAGES.CONFIRM_EMAIL}
        </div>
      ) : (
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
              autoComplete="email"
              required
              placeholder="you@club.com"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={
                mode === "sign-in" ? "current-password" : "new-password"
              }
              required
              minLength={mode === "sign-up" ? 8 : undefined}
              placeholder={
                mode === "sign-up" ? "At least 8 characters" : "••••••••"
              }
            />
          </div>
          <Button className="w-full" disabled={pending}>
            {pending
              ? mode === "sign-in"
                ? "Signing in…"
                : "Creating account…"
              : mode === "sign-in"
                ? "Sign in"
                : "Create account"}
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
