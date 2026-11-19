export const BILLING_ERROR_MESSAGES = {
  signIn: "Sign in to manage your plan.",
  notHost: "Only the club host can change the plan.",
  unconfigured:
    "Billing isn't connected yet. Add the PayMongo keys, then try again.",
  checkout: "Could not start checkout. Try again.",
  trial: "Could not start the trial. Try again.",
  clubRequired: "Choose a tournament day to open tournament mode.",
  date: "Choose the first day of the tournament.",
  past: "Tournament days start today or later.",
  openPlay: "Open play is paused until the club plan is active.",
  booking: "This club isn't taking bookings right now.",
  tournament:
    "Tournament mode is locked. An active club plan and a tournament day are required.",
  success:
    "Payment received. Your plan updates as soon as PayMongo confirms it.",
  cancel: "Checkout was canceled. Nothing was charged.",
} as const;

export type BillingNoticeCode =
  | "unconfigured"
  | "checkout"
  | "trial"
  | "club"
  | "date"
  | "past"
  | "success"
  | "cancel"
  | "locked";

/** Drop a return-code query so a refresh does not repeat the notice. */
export function pathWithoutSearchParam(href: string, key: string): string {
  const url = new URL(href, "http://localhost");
  url.searchParams.delete(key);
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
}

/** PayMongo's return URL should not reopen the plans dialog. */
export function billingNoticeOpensPlans(code: string | undefined): boolean {
  if (code === "success" || code === "cancel") return false;
  return billingNoticeMessage(code) !== null;
}

export function paymentReceivedCopy(input: {
  applied: boolean;
  kinds: Array<"club" | "day" | "weekend">;
}): string {
  if (!input.applied) {
    return "PayMongo is still confirming this payment. The upgrade reminder stays until that confirmation arrives.";
  }
  const club = input.kinds.includes("club");
  const pass = input.kinds.includes("day") || input.kinds.includes("weekend");
  if (club && pass) {
    return "Your club month is active, and tournament mode is open for the days you bought.";
  }
  if (pass) return "Tournament mode is open for the days you bought.";
  return "Your club month is active.";
}

export function billingNoticeMessage(code: string | undefined): string | null {
  switch (code) {
    case "unconfigured":
      return BILLING_ERROR_MESSAGES.unconfigured;
    case "checkout":
      return BILLING_ERROR_MESSAGES.checkout;
    case "trial":
      return BILLING_ERROR_MESSAGES.trial;
    case "club":
      return BILLING_ERROR_MESSAGES.clubRequired;
    case "date":
      return BILLING_ERROR_MESSAGES.date;
    case "past":
      return BILLING_ERROR_MESSAGES.past;
    case "success":
      return BILLING_ERROR_MESSAGES.success;
    case "cancel":
      return BILLING_ERROR_MESSAGES.cancel;
    case "locked":
      return BILLING_ERROR_MESSAGES.openPlay;
    default:
      return null;
  }
}
