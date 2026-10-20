"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateAccountThemeAction } from "@/app/actions/theme";
import {
  applyTheme,
  THEME_ERROR_MESSAGES,
  THEME_OPTIONS,
  type ThemeId,
} from "@/lib/theme";

export function ThemePicker({ theme }: { theme: ThemeId }) {
  const [selected, setSelected] = useState(theme);
  const [, startTransition] = useTransition();
  const request = useRef(theme);

  function choose(next: ThemeId) {
    if (next === request.current) return;
    const previous = request.current;
    request.current = next;
    setSelected(next);
    applyTheme(next);
    startTransition(async () => {
      try {
        const result = await updateAccountThemeAction(next);
        if (request.current !== next) return;
        if ("error" in result) {
          request.current = previous;
          setSelected(previous);
          applyTheme(previous);
          toast.error(result.error);
        }
      } catch (err) {
        console.error("[theme] save failed", err);
        if (request.current !== next) return;
        request.current = previous;
        setSelected(previous);
        applyTheme(previous);
        toast.error(THEME_ERROR_MESSAGES.save);
      }
    });
  }

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="mb-1 font-semibold">Theme</h2>
      <p className="mb-4 text-sm text-[var(--muted)]">
        Color theme for this account. Court is the default.
      </p>
      <div
        className="flex flex-wrap gap-2"
        role="radiogroup"
        aria-label="Color theme"
      >
        {THEME_OPTIONS.map((option) => {
          const active = selected === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choose(option.id)}
              className={
                active
                  ? "inline-flex items-center gap-2 rounded-md border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-sm font-medium text-[var(--accent-fg-soft)]"
                  : "inline-flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--foreground)]"
              }
            >
              <span
                aria-hidden
                className="h-3.5 w-3.5 rounded-full border border-black/10"
                style={{ backgroundColor: option.swatch }}
              />
              {option.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
