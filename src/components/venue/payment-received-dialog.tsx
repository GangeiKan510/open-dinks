"use client";

import { Check } from "lucide-react";
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

export function ReceiptSentDialog({ message }: { message: string }) {
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
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--highlight)]/80 bg-[var(--highlight)]/15 text-[var(--highlight)]">
            <Check className="h-8 w-8" strokeWidth={2.5} aria-hidden />
          </div>
          <DialogHeader className="items-center px-6 text-center">
            <DialogTitle className="font-[family-name:var(--font-display)] text-2xl">
              Payment sent
            </DialogTitle>
            <DialogDescription className="text-base text-[var(--foreground)]">
              {message}
            </DialogDescription>
          </DialogHeader>
          <Button type="button" className="w-full" onClick={close}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
