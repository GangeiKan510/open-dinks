"use client";

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
        Sign out
      </Button>
    </form>
  );
}
