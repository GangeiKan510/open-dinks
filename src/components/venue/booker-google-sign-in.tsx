"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AUTH_ERROR_MESSAGES, mapAuthError } from "@/lib/auth-errors";
import type { PublicBooker } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/client";

function googleRedirectTo(nextPath: string): string {
  const base = window.location.origin;
  const next = encodeURIComponent(nextPath);
  return `${base}/auth/callback?next=${next}`;
}

export function BookerGoogleSignIn({
  nextPath,
  booker,
}: {
  nextPath: string;
  booker: PublicBooker | null;
}) {
  const [pending, startTransition] = useTransition();
  const [signingOut, setSigningOut] = useState(false);

  function signInWithGoogle() {
    startTransition(async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: googleRedirectTo(nextPath),
            queryParams: {
              access_type: "offline",
              prompt: "select_account",
            },
          },
        });
        if (error) {
          toast.error(mapAuthError(error, "SIGN_IN_FAILED"));
        }
      } catch (err) {
        console.error("[auth] Google sign-in failed", err);
        toast.error(AUTH_ERROR_MESSAGES.SIGN_IN_FAILED);
      }
    });
  }

  function signOut() {
    setSigningOut(true);
    startTransition(async () => {
      try {
        const supabase = createClient();
        await supabase.auth.signOut();
        window.location.reload();
      } catch (err) {
        console.error("[auth] sign-out failed", err);
        toast.error(AUTH_ERROR_MESSAGES.SIGN_IN_FAILED);
        setSigningOut(false);
      }
    });
  }

  if (booker) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
        <p>
          Signed in as{" "}
          <span className="font-medium text-[var(--foreground)]">
            {booker.displayName}
          </span>
          {booker.email ? (
            <span className="text-[var(--muted)]"> · {booker.email}</span>
          ) : null}
        </p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          loading={signingOut || pending}
          onClick={signOut}
        >
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className="max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Sign in to continue</DialogTitle>
          <DialogDescription>
            Sign in with Google to request a court or coaching session. This
            helps the venue know who submitted the request and cuts down spam.
          </DialogDescription>
        </DialogHeader>
        <Button
          type="button"
          loading={pending}
          onClick={signInWithGoogle}
          className="w-full"
        >
          Continue with Google
        </Button>
      </DialogContent>
    </Dialog>
  );
}
