"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { pathWithoutSearchParam } from "@/lib/billing-messages";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function PaymentReceivedDialog({ message }: { message: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  function close() {
    setOpen(false);
    router.replace(pathWithoutSearchParam(window.location.href, "billing"), {
      scroll: false,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-[family-name:var(--font-display)] text-2xl">
            Payment received
          </DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <Button type="button" onClick={close}>
          Back to the club
        </Button>
      </DialogContent>
    </Dialog>
  );
}
