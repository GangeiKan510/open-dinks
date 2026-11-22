import { DISCOUNT_CODE_MESSAGE } from "@/lib/discounts";

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
  owned: "Those days are already paid. Pick dates you have not bought.",
  code: DISCOUNT_CODE_MESSAGE,
  openPlay: "Open play is paused until the club plan is active.",
  booking: "This club isn't taking bookings right now.",
  tournament:
    "Tournament mode is locked. An active club plan and a tournament day are required.",
  success:
    "Payment received. Your plan updates as soon as PayMongo confirms it.",
  cancel: "Checkout was canceled. Nothing was charged.",
  proof: "Receipt received. The plan opens after the GCash payment is checked.",
  proofFile: "Upload a PNG, JPEG, or WebP screenshot of the GCash receipt.",
  proofLarge: "The receipt must be 5 MB or smaller.",
  proofPending: "A receipt for that plan is already waiting to be checked.",
  proofSave: "Could not save the receipt. Try again.",
} as const;

export type BillingNoticeCode =
  | "unconfigured"
  | "checkout"
  | "trial"
  | "club"
  | "date"
  | "past"
  | "owned"
  | "code"
  | "success"
  | "cancel"
  | "locked"
  | "proof"
  | "proof-file"
  | "proof-large"
  | "proof-pending"
  | "proof-save";

/** Drop a return-code query so a refresh does not repeat the notice. */
export function pathWithoutSearchParam(href: string, key: string): string {
  const url = new URL(href, "http://localhost");
  url.searchParams.delete(key);
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
}

/** PayMongo's return URL should not reopen the plans dialog. */
export function billingNoticeOpensPlans(code: string | undefined): boolean {
  if (code === "success" || code === "cancel" || code === "proof") return false;
  return billingNoticeMessage(code) !== null;
}

/** Status line beside the plan chips while the club month is not active. */
export function clubPlanStatusCopy(pendingApproval: boolean): string {
  if (pendingApproval) {
    return "Club plan opens once an admin approves the payment.";
  }
  return "Club plan paused";
}

/** Open play empty state while the club month is not active. */
export function openPlayPausedCopy(input: {
  pendingApproval: boolean;
  liveSession: boolean;
  trialAvailable: boolean;
}): { title: string; detail: string } {
  const ending = input.liveSession
    ? " End the session that is still marked live. The console stays closed until the club plan is active."
    : "";
  if (input.pendingApproval) {
    return {
      title: "Open play opens with the club plan",
      detail:
        "An admin will open the club month after checking the receipt. Open play stays closed until then." +
        ending,
    };
  }
  const start = input.trialAvailable
    ? "Start the free trial or pay for a club month to run open play."
    : "Pay for a club month to run open play.";
  return {
    title: "Open play is paused",
    detail: start + ending,
  };
}

export function receiptSentCopy(kind: "club" | "day"): string {
  const opens =
    kind === "club" ? "open the club month" : "open those tournament days";
  return `You have successfully sent your payment. An admin will check the receipt and ${opens}.`;
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
    return "Your club month is active. Tournament mode is open, and brackets can be built on the days you bought.";
  }
  if (pass) {
    return "Tournament mode is open. Brackets can be built on the days you bought.";
  }
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
    case "owned":
      return BILLING_ERROR_MESSAGES.owned;
    case "code":
      return BILLING_ERROR_MESSAGES.code;
    case "success":
      return BILLING_ERROR_MESSAGES.success;
    case "cancel":
      return BILLING_ERROR_MESSAGES.cancel;
    case "proof":
      return BILLING_ERROR_MESSAGES.proof;
    case "proof-file":
      return BILLING_ERROR_MESSAGES.proofFile;
    case "proof-large":
      return BILLING_ERROR_MESSAGES.proofLarge;
    case "proof-pending":
      return BILLING_ERROR_MESSAGES.proofPending;
    case "proof-save":
      return BILLING_ERROR_MESSAGES.proofSave;
    case "locked":
      return BILLING_ERROR_MESSAGES.openPlay;
    default:
      return null;
  }
}
