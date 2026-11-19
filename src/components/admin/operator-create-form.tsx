"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createFirstOperatorAction,
  createOperatorAction,
} from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OperatorCreateForm({
  setupKey = false,
  onCreated,
}: {
  setupKey?: boolean;
  onCreated?: (input: { email: string; password: string }) => Promise<void>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [key, setKey] = useState("");

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = onCreated
        ? await createFirstOperatorAction(formData)
        : await createOperatorAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (onCreated) {
        await onCreated({ email, password });
        return;
      }
      setEmail("");
      setPassword("");
      setDisplayName("");
      toast.success("Operator account created.");
      router.refresh();
    });
  }

  return (
    <form
      className="space-y-4"
      action={(formData) => {
        onSubmit(formData);
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="operator-name">Display name</Label>
        <Input
          id="operator-name"
          name="displayName"
          autoComplete="name"
          required
          maxLength={80}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="operator-email">Email</Label>
        <Input
          id="operator-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="operator-password">Password</Label>
        <Input
          id="operator-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {setupKey ? (
        <div className="space-y-1">
          <Label htmlFor="operator-setup-key">Setup key</Label>
          <Input
            id="operator-setup-key"
            name="setupKey"
            type="password"
            autoComplete="off"
            required
            value={key}
            onChange={(event) => setKey(event.target.value)}
          />
        </div>
      ) : null}
      <Button className="w-full" loading={pending}>
        {pending ? "Creating…" : "Create operator account"}
      </Button>
    </form>
  );
}
