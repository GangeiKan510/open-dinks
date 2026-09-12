import { afterEach, describe, expect, it, vi } from "vitest";
import { createCoalescedAsync } from "./coalesce-async";

describe("createCoalescedAsync", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs once for a burst of calls in the wait window", async () => {
    vi.useFakeTimers();
    const fn = vi.fn(async () => {});
    const schedule = createCoalescedAsync(fn, 100);

    const first = schedule();
    const second = schedule();
    const third = schedule();

    expect(fn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    await Promise.all([first, second, third]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("runs once more when a call arrives during an in-flight run", async () => {
    vi.useFakeTimers();
    let releaseFirst: (() => void) | undefined;
    let isFirst = true;
    const fn = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          if (isFirst) {
            isFirst = false;
            releaseFirst = resolve;
            return;
          }
          resolve();
        }),
    );
    const schedule = createCoalescedAsync(fn, 40);

    const first = schedule();
    await vi.advanceTimersByTimeAsync(40);
    expect(fn).toHaveBeenCalledTimes(1);

    const second = schedule();
    releaseFirst?.();
    await Promise.all([first, second]);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
