import { describe, expect, it } from "vitest";
import { ADMIN_ERROR_MESSAGES } from "./admin-messages";
import {
  feedbackLogoProblem,
  feedbackLogoSrc,
  parseFeedbackSubmission,
  ratingStars,
} from "./feedback";

describe("anonymous feedback", () => {
  it("drops a honeypot submission without an error", () => {
    expect(
      parseFeedbackSubmission({
        body: "This is long enough",
        rating: "5",
        name: "PicklePlace",
        website: "https://spam.example",
      }),
    ).toEqual({ ok: true, ignored: true });
  });

  it("keeps a trimmed note and an optional rating", () => {
    expect(
      parseFeedbackSubmission({
        body: "  The queue felt fair tonight.  ",
        name: "  PicklePlace  ",
        rating: "",
        website: "  ",
      }),
    ).toEqual({
      ok: true,
      ignored: false,
      body: "The queue felt fair tonight.",
      authorName: "PicklePlace",
      rating: null,
    });
    expect(
      parseFeedbackSubmission({
        body: "Courts moved quickly.",
        name: "Ace Club",
        rating: "4",
        website: "",
      }),
    ).toEqual({
      ok: true,
      ignored: false,
      body: "Courts moved quickly.",
      authorName: "Ace Club",
      rating: 4,
    });
  });

  it("rejects short notes, long notes, and ratings outside 1 to 5", () => {
    expect(
      parseFeedbackSubmission({
        body: "short",
        name: "Ace Club",
        rating: "",
        website: "",
      }).ok,
    ).toBe(false);
    expect(
      parseFeedbackSubmission({
        body: "short",
        name: "Ace Club",
        rating: "",
        website: "",
      }),
    ).toEqual({ ok: false, error: ADMIN_ERROR_MESSAGES.feedbackShort });
    expect(
      parseFeedbackSubmission({
        body: "x".repeat(2001),
        name: "Ace Club",
        rating: "",
        website: "",
      }),
    ).toEqual({ ok: false, error: ADMIN_ERROR_MESSAGES.feedbackLong });
    expect(
      parseFeedbackSubmission({
        body: "Long enough to send",
        name: "Ace Club",
        rating: "6",
        website: "",
      }),
    ).toEqual({ ok: false, error: ADMIN_ERROR_MESSAGES.feedbackRating });
    expect(
      parseFeedbackSubmission({
        body: "Long enough to send",
        name: "Ace Club",
        rating: "0",
        website: "",
      }),
    ).toEqual({ ok: false, error: ADMIN_ERROR_MESSAGES.feedbackRating });
  });

  it("requires a club name", () => {
    expect(
      parseFeedbackSubmission({
        body: "Long enough to send",
        name: " ",
        rating: "",
        website: "",
      }),
    ).toEqual({ ok: false, error: ADMIN_ERROR_MESSAGES.feedbackName });
    expect(
      parseFeedbackSubmission({
        body: "Long enough to send",
        name: "A",
        rating: "",
        website: "",
      }),
    ).toEqual({ ok: false, error: ADMIN_ERROR_MESSAGES.feedbackName });
    expect(
      parseFeedbackSubmission({
        body: "Long enough to send",
        name: "A".repeat(81),
        rating: "",
        website: "",
      }),
    ).toEqual({ ok: false, error: ADMIN_ERROR_MESSAGES.feedbackNameLong });
  });

  it("renders a featured rating as stars", () => {
    expect(ratingStars(4)).toBe("★★★★☆");
    expect(ratingStars(null)).toBeNull();
    expect(ratingStars(0)).toBeNull();
  });

  it("accepts a png, jpeg, or webp logo within 2 MB", () => {
    expect(
      feedbackLogoProblem({ size: 1200, type: "image/png", name: "club.png" }),
    ).toBeNull();
    expect(
      feedbackLogoProblem({
        size: 1200,
        type: "image/jpeg",
        name: "club.jpeg",
      }),
    ).toBeNull();
    expect(
      feedbackLogoProblem({
        size: 1200,
        type: "",
        name: "club.webp",
      }),
    ).toBeNull();
    expect(
      feedbackLogoProblem({ size: 0, type: "image/png", name: "club.png" }),
    ).toBeNull();
  });

  it("rejects a logo that is the wrong type or too large", () => {
    expect(
      feedbackLogoProblem({
        size: 20,
        type: "image/svg+xml",
        name: "club.svg",
      }),
    ).toBe(ADMIN_ERROR_MESSAGES.feedbackLogoType);
    expect(
      feedbackLogoProblem({
        size: 2 * 1024 * 1024 + 1,
        type: "image/png",
        name: "club.png",
      }),
    ).toBe(ADMIN_ERROR_MESSAGES.feedbackLogoSize);
  });

  it("shows only the logo stored for that note", () => {
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const url = `https://example.supabase.co/storage/v1/object/public/feedback-logos/${id}.png`;
    expect(feedbackLogoSrc(id, url)).toBe(url);
    expect(feedbackLogoSrc(id.toUpperCase(), url)).toBe(url);
    expect(
      feedbackLogoSrc("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", url),
    ).toBeNull();
    expect(feedbackLogoSrc(id, url.replace("https:", "http:"))).toBeNull();
    expect(feedbackLogoSrc(id, url.replace(".png", ".svg"))).toBeNull();
    expect(feedbackLogoSrc(id, `${url.slice(0, -4)}/extra.png`)).toBeNull();
    expect(feedbackLogoSrc(id, null)).toBeNull();
  });
});
