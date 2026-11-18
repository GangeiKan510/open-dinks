export const BILLING_ERROR_MESSAGES = {
  signIn: "Sign in to manage your plan.",
  notHost: "Only the club host can change the plan.",
  unconfigured:
    "Billing isn't connected yet. Add the PayMongo keys, then try again.",
  checkout: "Could not start checkout. Try again.",
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
  | "club"
  | "date"
  | "past"
  | "success"
  | "cancel"
  | "locked";

export function billingNoticeMessage(code: string | undefined): string | null {
  switch (code) {
    case "unconfigured":
      return BILLING_ERROR_MESSAGES.unconfigured;
    case "checkout":
      return BILLING_ERROR_MESSAGES.checkout;
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
