export const FACILITY_ERROR_MESSAGES = {
  signIn: "Sign in to manage your facility.",
  name: "Facility name is required.",
  noFacility: "Set up your facility first.",
  profile:
    "Could not prepare your host profile. Apply the latest Supabase migrations, then try again.",
  schema:
    "Facility schema is out of date. Run the latest Supabase migrations, then try again.",
  create: "Could not create your facility. Try again.",
  courts: "Could not update your courts. Try again.",
  save: "Could not save your changes. Try again.",
  bookingHours: "Choose valid opening and closing hours.",
} as const;

export type CourtInUseReason = "booked" | "playing";

/** Court removal is blocked while the court is still spoken for. */
export function formatCourtInUseMessage(
  courtName: string,
  reason: CourtInUseReason,
): string {
  const court = courtName.trim() || "That court";
  if (reason === "booked") {
    return `${court} has an upcoming booking. Cancel it before reducing your court count.`;
  }
  return `${court} has a game in progress. Finish it before reducing your court count.`;
}
