"use client";

import { Star } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { submitFeedbackAction } from "@/app/actions/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

export function FeedbackForm() {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const shown = hover || rating;

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await submitFeedbackAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSent(true);
    });
  }

  function chooseLogo(file: File | undefined) {
    setLogoPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  function clearLogo() {
    if (fileRef.current) fileRef.current.value = "";
    chooseLogo(undefined);
  }

  if (sent) {
    return (
      <p className="text-sm text-[var(--foreground)]" role="status">
        Thanks. If we feature it, it shows with your club&apos;s name.
      </p>
    );
  }

  return (
    <form
      className="relative space-y-4"
      action={(formData) => {
        onSubmit(formData);
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="feedback-name">Club name</Label>
        <Input
          id="feedback-name"
          name="name"
          required
          minLength={2}
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="PicklePlace"
        />
      </div>
      <div className="space-y-2">
        <Label id="feedback-rating-label">Stars, if you want them</Label>
        <div
          className="flex gap-1"
          role="group"
          aria-labelledby="feedback-rating-label"
          onMouseLeave={() => setHover(0)}
        >
          {STAR_VALUES.map((value) => {
            const filled = value <= shown;
            return (
              <Button
                key={value}
                type="button"
                size="icon"
                variant="ghost"
                aria-pressed={rating === value}
                aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
                className={
                  filled
                    ? "text-[var(--highlight)]"
                    : "text-[var(--muted)] hover:text-[var(--highlight)]"
                }
                onMouseEnter={() => setHover(value)}
                onFocus={() => setHover(value)}
                onBlur={() => setHover(0)}
                onClick={() => {
                  setRating(rating === value ? 0 : value);
                  setHover(0);
                }}
              >
                <Star
                  className="h-5 w-5"
                  fill={filled ? "currentColor" : "none"}
                  aria-hidden
                />
              </Button>
            );
          })}
        </div>
        <input type="hidden" name="rating" value={rating || ""} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="feedback-body">Note</Label>
        <textarea
          id="feedback-body"
          name="body"
          required
          minLength={8}
          maxLength={2000}
          rows={4}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="What should we know about a session, a court, or the board?"
          className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="feedback-logo">Club logo, if you want one</Label>
        <Input
          ref={fileRef}
          id="feedback-logo"
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="h-auto py-2 file:mr-3 file:rounded-md file:border-0 file:bg-[var(--surface-2)] file:px-2 file:py-1 file:text-xs file:text-[var(--foreground)]"
          onChange={(event) => chooseLogo(event.target.files?.[0])}
        />
        <p className="text-xs text-[var(--muted)]">
          PNG, JPEG, or WebP, up to 2 MB. It shows with the note only if we
          feature it.
        </p>
        {logoPreview ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoPreview}
              alt="Selected club logo"
              className="h-12 w-12 rounded-md border border-[var(--border)] bg-[var(--surface)] object-contain"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearLogo}
            >
              Remove logo
            </Button>
          </div>
        ) : null}
      </div>
      <div className="absolute h-px w-px overflow-hidden" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Button loading={pending}>{pending ? "Sending…" : "Send note"}</Button>
    </form>
  );
}
