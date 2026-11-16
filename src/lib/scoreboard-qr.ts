/** Download names stay `[a-z0-9-]` so shared files do not keep punctuation. */
export function scoreboardQrDownloadName(eventName: string): string {
  const slug = eventName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "scoreboard"}-qr.png`;
}
