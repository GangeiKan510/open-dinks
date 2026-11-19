"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function PaymentReceivedDialog({ message }: { message: string }) {
  const [open, setOpen] = useState(true);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-[family-name:var(--font-display)] text-2xl">
            Payment received
          </DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <Button type="button" onClick={() => setOpen(false)}>
          Back to the club
        </Button>
      </DialogContent>
    </Dialog>
  );
}
