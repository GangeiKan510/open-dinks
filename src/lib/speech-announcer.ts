/** Minimum ms left before we fire the warning announcement. */
export const DEFAULT_WARNING_MINUTES = 2;

export function warningThresholdMs(warningMinutes: number): number {
  return Math.max(1, warningMinutes) * 60_000;
}

/** True when the game is long enough to warrant a warning and time left is within the window. */
export function isWithinWarningWindow(
  remainingMs: number | null,
  maxGameMinutes: number,
  warningMinutes: number,
): boolean {
  if (remainingMs == null || remainingMs <= 0) return false;
  const warnMs = warningThresholdMs(warningMinutes);
  const maxMs = maxGameMinutes * 60_000;
  if (maxMs <= warnMs) return false;
  return remainingMs <= warnMs;
}

export function isTimeUp(
  matchStatus: string,
  remainingMs: number | null,
): boolean {
  return matchStatus === "active" && remainingMs === 0;
}

export function formatTimeUpAnnouncement(courtName: string): string {
  return `${courtName}, session ended.`;
}

/** Join player names for speech: "A, B, and C". */
export function formatPlayerListForSpeech(names: string[]): string {
  const cleaned = names.map((n) => n.trim()).filter(Boolean);
  if (cleaned.length === 0) return "";
  if (cleaned.length === 1) return cleaned[0];
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(", ")}, and ${cleaned[cleaned.length - 1]}`;
}

export function formatPrepareAnnouncement(playerNames: string[]): string {
  const list = formatPlayerListForSpeech(playerNames);
  if (!list) return "Next court, please prepare for your game.";
  return `${list}, please prepare for your game.`;
}

export function formatStartSessionAnnouncement(
  courtName: string,
  playerNames: string[],
): string {
  const list = formatPlayerListForSpeech(playerNames);
  if (!list) {
    return `Starting game session in ${courtName}.`;
  }
  return `Starting game session in ${courtName} for ${list}.`;
}

export function formatRemainingTimeForSpeech(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds} second${seconds === 1 ? "" : "s"}`;
  }
  if (seconds === 0) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  return `${minutes} minute${minutes === 1 ? "" : "s"} ${seconds} second${seconds === 1 ? "" : "s"}`;
}

export function formatRemainingTimeAnnouncement(
  courtName: string,
  remainingMs: number | null,
  timeUp: boolean,
): string {
  if (timeUp || remainingMs === 0) {
    return formatTimeUpAnnouncement(courtName);
  }
  if (remainingMs == null) {
    return `${courtName}, timer not started.`;
  }
  return `${courtName}, ${formatRemainingTimeForSpeech(remainingMs)} remaining.`;
}

/** Slightly under 1 so gym announcements are easier to catch. */
export const ANNOUNCEMENT_SPEECH_RATE = 0.85;

export function speakAnnouncement(text: string): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = ANNOUNCEMENT_SPEECH_RATE;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

/** Prime speech synthesis after a user gesture (required on some browsers). */
export function primeSpeechAnnouncer(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance("");
  utterance.volume = 0;
  window.speechSynthesis.speak(utterance);
  window.speechSynthesis.cancel();
}
