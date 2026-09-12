/**
 * Collapse a burst of calls into one in-flight run of `fn`.
 *
 * Calls during the wait window share the next run. Calls that arrive while
 * `fn` is already running share one follow-up run so the last write wins
 * without N sequential refreshes.
 */
export function createCoalescedAsync(
  fn: () => Promise<void>,
  waitMs: number,
): () => Promise<void> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  const waiters: Array<{
    resolve: () => void;
    reject: (error: unknown) => void;
  }> = [];

  const flush = async () => {
    running = true;
    try {
      while (waiters.length > 0) {
        const batch = waiters.splice(0, waiters.length);
        try {
          await fn();
          for (const waiter of batch) waiter.resolve();
        } catch (error) {
          for (const waiter of batch) waiter.reject(error);
        }
      }
    } finally {
      running = false;
    }
  };

  return () =>
    new Promise<void>((resolve, reject) => {
      waiters.push({ resolve, reject });
      if (running) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void flush();
      }, waitMs);
    });
}
