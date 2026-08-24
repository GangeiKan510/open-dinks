import { describe, expect, it } from "vitest";
import {
  DEFAULT_WARNING_MINUTES,
  formatPlayerListForSpeech,
  formatPrepareAnnouncement,
  formatRemainingTimeAnnouncement,
  formatRemainingTimeForSpeech,
  formatStartSessionAnnouncement,
  formatTimeUpAnnouncement,
  isTimeUp,
  isWithinWarningWindow,
  warningThresholdMs,
} from "@/lib/speech-announcer";

describe("speech announcer thresholds", () => {
  it("warns when remaining is within the window and game is longer than warning", () => {
    const warnMs = warningThresholdMs(DEFAULT_WARNING_MINUTES);
    expect(isWithinWarningWindow(warnMs, 15, DEFAULT_WARNING_MINUTES)).toBe(
      true,
    );
    expect(
      isWithinWarningWindow(warnMs + 1000, 15, DEFAULT_WARNING_MINUTES),
    ).toBe(false);
    expect(isWithinWarningWindow(0, 15, DEFAULT_WARNING_MINUTES)).toBe(false);
  });

  it("does not warn when max game is shorter than warning period", () => {
    expect(isWithinWarningWindow(60_000, 1, 2)).toBe(false);
  });

  it("detects time up only for active matches at zero remaining", () => {
    expect(isTimeUp("active", 0)).toBe(true);
    expect(isTimeUp("ready", 0)).toBe(false);
    expect(isTimeUp("active", 1000)).toBe(false);
  });

  it("formats session-ended announcement copy", () => {
    expect(formatTimeUpAnnouncement("Court 1")).toBe("Court 1, session ended.");
  });

  it("formats player lists for speech", () => {
    expect(formatPlayerListForSpeech(["Alex"])).toBe("Alex");
    expect(formatPlayerListForSpeech(["Alex", "Blake"])).toBe("Alex and Blake");
    expect(formatPlayerListForSpeech(["Alex", "Blake", "Casey", "Drew"])).toBe(
      "Alex, Blake, Casey, and Drew",
    );
  });

  it("formats prepare announcement copy", () => {
    expect(formatPrepareAnnouncement(["Alex", "Blake", "Casey", "Drew"])).toBe(
      "Alex, Blake, Casey, and Drew, please prepare for your game.",
    );
    expect(formatPrepareAnnouncement([])).toBe(
      "Next court, please prepare for your game.",
    );
  });

  it("formats start session announcement copy", () => {
    expect(
      formatStartSessionAnnouncement("Court 1", [
        "Alex",
        "Blake",
        "Casey",
        "Drew",
      ]),
    ).toBe(
      "Starting game session in Court 1 for Alex, Blake, Casey, and Drew.",
    );
    expect(formatStartSessionAnnouncement("Court 2", [])).toBe(
      "Starting game session in Court 2.",
    );
  });

  it("formats remaining time for speech", () => {
    expect(formatRemainingTimeForSpeech(6 * 60_000 + 50_000)).toBe(
      "6 minutes 50 seconds",
    );
    expect(formatRemainingTimeForSpeech(60_000)).toBe("1 minute");
    expect(formatRemainingTimeForSpeech(45_000)).toBe("45 seconds");
  });

  it("formats court remaining time announcement", () => {
    expect(formatRemainingTimeAnnouncement("Court 1", 410_000, false)).toBe(
      "Court 1, 6 minutes 50 seconds remaining.",
    );
    expect(formatRemainingTimeAnnouncement("Court 1", 0, true)).toBe(
      "Court 1, session ended.",
    );
  });
});
