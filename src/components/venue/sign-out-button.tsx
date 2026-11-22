"use client";

import { LogOut } from "lucide-react";
import { useFormStatus } from "react-dom";
import { signOutAction } from "@/app/actions/session";
import { Button } from "@/components/ui/button";
import { clearStoredTheme } from "@/lib/theme";

function SignOutSubmit() {
  const { pending } = useFormStatus();

  return (
    <Button variant="outline" type="submit" loading={pending}>
      <LogOut className="h-4 w-4 shrink-0" aria-hidden />
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}

export function SignOutButton() {
  return (
    <form
      action={signOutAction}
      onSubmit={() => {
        clearStoredTheme();
      }}
    >
      <SignOutSubmit />
    </form>
  );
}
