"use client";

import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/actions/session";
import { Button } from "@/components/ui/button";
import { clearStoredTheme } from "@/lib/theme";

export function SignOutButton() {
  return (
    <form
      action={signOutAction}
      onSubmit={() => {
        clearStoredTheme();
      }}
    >
      <Button variant="outline" type="submit">
        <LogOut className="h-4 w-4 shrink-0" aria-hidden />
        Sign out
      </Button>
    </form>
  );
}
