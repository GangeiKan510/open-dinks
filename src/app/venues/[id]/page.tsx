import { redirect } from "next/navigation";

/**
 * Venues are no longer a user-facing concept: each account runs exactly one
 * facility, managed from the dashboard. Kept as a redirect so bookmarks and
 * older links from before the change still land somewhere useful.
 */
export default async function VenueRedirectPage() {
  redirect("/dashboard");
}
