"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type Ref,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_ERROR_MESSAGES, mapAuthError } from "@/lib/auth-errors";
import { safeAuthNextPath } from "@/lib/auth-redirect";
import { PRODUCT_NAME } from "@/lib/facility";
import { applyTheme, clearStoredTheme, parseTheme } from "@/lib/theme";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Mode = "sign-in" | "sign-up";

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

function subscribeAuthLink(): () => void {
  return () => {};
}

function authLinkFailedSnapshot(): boolean {
  return new URLSearchParams(window.location.search).get("error") === "auth";
}

export default function LoginPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const authLinkFailed = useSyncExternalStore(
    subscribeAuthLink,
    authLinkFailedSnapshot,
    () => false,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const announcedAuthError = useRef(false);

  useEffect(() => {
    if (!authLinkFailed || announcedAuthError.current) return;
    announcedAuthError.current = true;
    toast.error(AUTH_ERROR_MESSAGES.AUTH_LINK_FAILED);
  }, [authLinkFailed]);

  function showSignIn() {
    setMode("sign-in");
    setNeedsConfirmation(false);
    setConfirmPassword("");
  }

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
    if (mode === "sign-up" && password !== confirmPassword) {
      toast.error(AUTH_ERROR_MESSAGES.PASSWORD_MISMATCH);
      confirmPasswordRef.current?.focus();
      confirmPasswordRef.current?.select();
      return;
    }

    startTransition(async () => {
      try {
        const supabase = createClient();

        if (mode === "sign-in") {
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
          return;
        }

        const siteUrl =
          process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
          window.location.origin;

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(authNextPath())}`,
          },
        });

        if (error) {
          console.error("[auth] signUp failed", error);
          toast.error(mapAuthError(error, "SIGN_UP_FAILED"));
          passwordRef.current?.focus();
          passwordRef.current?.select();
          return;
        }

        if (data.session && data.user) {
          await syncAccountTheme(supabase, data.user.id);
          router.push(authNextPath());
          router.refresh();
          return;
        }

        clearStoredTheme();
        setNeedsConfirmation(true);
        toast.success(AUTH_ERROR_MESSAGES.CONFIRM_EMAIL);
      } catch (err) {
        console.error("[auth] unexpected failure", err);
        toast.error(
          mode === "sign-in"
            ? AUTH_ERROR_MESSAGES.SIGN_IN_FAILED
            : AUTH_ERROR_MESSAGES.SIGN_UP_FAILED,
        );
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
      <h1 className="mb-2 text-3xl font-semibold">
        {mode === "sign-in" ? "Host login" : "Create host account"}
      </h1>
      <p className="mb-6 text-[var(--muted)]">
        Email and password for organizers. Players book courts with Google on
        your public booking link — no host account needed.
      </p>
      {authLinkFailed ? (
        <p
          role="alert"
          className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm"
        >
          {AUTH_ERROR_MESSAGES.AUTH_LINK_FAILED}
        </p>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1">
        <button
          type="button"
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium transition",
            mode === "sign-in"
              ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
              : "text-[var(--muted)]",
          )}
          onClick={showSignIn}
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
        <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
          <p>{AUTH_ERROR_MESSAGES.CONFIRM_EMAIL}</p>
          <Button type="button" className="w-full" onClick={showSignIn}>
            Sign in
          </Button>
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
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <PasswordField
            id="password"
            label="Password"
            name="password"
            inputRef={passwordRef}
            autoComplete={
              mode === "sign-in" ? "current-password" : "new-password"
            }
            minLength={mode === "sign-up" ? 8 : undefined}
            placeholder={
              mode === "sign-up" ? "At least 8 characters" : "••••••••"
            }
            value={password}
            onChange={setPassword}
            visible={showPassword}
            onToggle={() => setShowPassword((current) => !current)}
          />
          {mode === "sign-up" ? (
            <div className="space-y-1">
              <PasswordField
                id="confirm-password"
                label="Confirm password"
                name="confirmPassword"
                inputRef={confirmPasswordRef}
                autoComplete="new-password"
                minLength={8}
                placeholder="Repeat the password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                visible={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((current) => !current)}
              />
              {password.length >= 8 && password === confirmPassword ? (
                <p
                  role="status"
                  className="flex items-center gap-1.5 text-sm font-medium text-[var(--highlight)]"
                >
                  <Check className="h-4 w-4 shrink-0" aria-hidden />
                  Passwords match
                </p>
              ) : null}
            </div>
          ) : null}
          <Button className="w-full" loading={pending}>
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
    </main>
  );
}

function PasswordField({
  id,
  label,
  name,
  inputRef,
  autoComplete,
  minLength,
  placeholder,
  value,
  onChange,
  visible,
  onToggle,
}: {
  id: string;
  label: string;
  name: string;
  inputRef?: Ref<HTMLInputElement>;
  autoComplete: string;
  minLength?: number;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          minLength={minLength}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="pr-10"
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md bg-transparent text-[var(--muted)] hover:bg-transparent hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          aria-label={
            visible
              ? `Hide ${label.toLowerCase()}`
              : `Show ${label.toLowerCase()}`
          }
          aria-pressed={visible}
          onClick={onToggle}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden />
          ) : (
            <Eye className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}
