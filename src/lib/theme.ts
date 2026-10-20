export const THEME_IDS = ["court", "blue", "green", "red", "mono"] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = "court";

export const THEME_COOKIE = "picklrz-theme";

export const THEME_STORAGE_KEY = "picklrz-theme";

export const THEME_OPTIONS: ReadonlyArray<{
  id: ThemeId;
  label: string;
  swatch: string;
}> = [
  { id: "court", label: "Court", swatch: "#4e7c34" },
  { id: "blue", label: "Blue", swatch: "#1f3a72" },
  { id: "green", label: "Green", swatch: "#1f7a4c" },
  { id: "red", label: "Red", swatch: "#8f2d2d" },
  { id: "mono", label: "Mono", swatch: "#1a1a1a" },
];

const THEME_ID_SET: ReadonlySet<string> = new Set(THEME_IDS);

export function parseTheme(value: unknown): ThemeId {
  if (typeof value === "string" && THEME_ID_SET.has(value)) {
    return value as ThemeId;
  }
  return DEFAULT_THEME;
}

/** Cookie wins when set, so the control matches the theme already on screen. */
export function resolveTheme(
  cookieValue: string | undefined | null,
  profileValue?: unknown,
): ThemeId {
  if (typeof cookieValue === "string" && cookieValue.length > 0) {
    return parseTheme(cookieValue);
  }
  return parseTheme(profileValue);
}

export const THEME_ERROR_MESSAGES = {
  signIn: "Sign in to change your theme.",
  save: "Could not save your theme. Try again.",
} as const;

export function themeCookieMaxAge(): number {
  return 60 * 60 * 24 * 365;
}

export function applyTheme(theme: ThemeId): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode can reject storage. The cookie still carries the choice.
  }
  document.cookie = `${THEME_COOKIE}=${encodeURIComponent(theme)}; Path=/; Max-Age=${themeCookieMaxAge()}; SameSite=Lax`;
}

export function clearStoredTheme(): void {
  document.documentElement.dataset.theme = DEFAULT_THEME;
  try {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // Ignore storage failures; the cookie clear below still runs.
  }
  document.cookie = `${THEME_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
