const BARS = ["title", "actions"] as const;
const STATS = ["courts", "requests", "bookings"] as const;

export function RouteLoading() {
  return (
    <main
      className="mx-auto max-w-5xl space-y-6 px-6 py-10"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="sr-only">Loading</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-3">
          <div className="h-3 w-28 animate-pulse rounded bg-[var(--surface-3)]" />
          <div className="h-10 w-64 max-w-full animate-pulse rounded-md bg-[var(--surface-2)]" />
        </div>
        <div className="flex gap-2">
          {BARS.map((key) => (
            <div
              key={key}
              className="h-10 w-28 animate-pulse rounded-md bg-[var(--surface-2)]"
            />
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {STATS.map((key) => (
          <div
            key={key}
            className="h-24 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]"
          />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
    </main>
  );
}
