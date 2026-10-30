"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_ERROR_MESSAGES, mapAuthError } from "@/lib/auth-errors";
import { safeAuthNextPath } from "@/lib/auth-redirect";
import { PRODUCT_NAME } from "@/lib/facility";
import { applyTheme, parseTheme } from "@/lib/theme";
import { createClient } from "@/lib/supabase/client";

async function syncAccountTheme(
  supabase: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("theme")
    .eq("id", userId)
    .maybeSingle();
  if (error) return;
  applyTheme(parseTheme(data?.theme));
}

function authNextPath(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return safeAuthNextPath(next);
}

export default function LoginPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const passwordRef = useRef<HTMLInputElement>(null);

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

    startTransition(async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          toast.error(mapAuthError(error, "SIGN_IN_FAILED"));
          passwordRef.current?.focus();
          passwordRef.current?.select();
          return;
        }
        if (data.user) await syncAccountTheme(supabase, data.user.id);
        router.push(authNextPath());
        router.refresh();
      } catch (err) {
        console.error("[auth] unexpected failure", err);
        toast.error(AUTH_ERROR_MESSAGES.SIGN_IN_FAILED);
        passwordRef.current?.focus();
        passwordRef.current?.select();
      }
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link
        href="/"
        className="mb-8 font-[family-name:var(--font-logo)] text-3xl leading-none"
      >
        {PRODUCT_NAME}
      </Link>
      <h1 className="mb-2 text-3xl font-semibold">Host login</h1>
      <p className="mb-6 text-[var(--muted)]">
        Email and password for organizers. Players book courts with Google on
        your public booking link — no host account needed.
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
            autoComplete="email"
            required
            placeholder="you@club.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">Password</Label>
          <Input
            ref={passwordRef}
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <Button className="w-full" loading={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-8 text-sm text-[var(--muted)]">
        No Supabase yet?{" "}
        <Link href="/demo" className="text-[var(--accent)] underline">
          Try the local demo
        </Link>{" "}
        or{" "}
        <Link href="/tournament" className="text-[var(--accent)] underline">
          run a tournament
        </Link>
        .
      </p>
    </main>
  );
}
