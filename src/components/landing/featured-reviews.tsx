import { ratingStars } from "@/lib/feedback";
import { loadFeaturedReviews } from "@/lib/feedback-server";

export async function FeaturedReviews() {
  const reviews = await loadFeaturedReviews();

  return (
    <section
      id="reviews"
      className="mx-auto max-w-6xl px-6 py-16"
      aria-label="Reviews"
    >
      <h2 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] md:text-4xl">
        Reviews
      </h2>
      {reviews.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          Featured notes from clubs show here.
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {reviews.map((review) => {
            const stars = ratingStars(review.rating);
            return (
              <li
                key={review.id}
                className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-5"
              >
                <div className="flex items-center gap-3">
                  {review.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={review.logoUrl}
                      alt={review.authorName ? `${review.authorName} logo` : ""}
                      className="h-14 w-14 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] object-contain"
                    />
                  ) : null}
                  <div>
                    {review.authorName ? (
                      <p className="font-medium text-[var(--foreground)]">
                        {review.authorName}
                      </p>
                    ) : null}
                    {stars ? (
                      <p className="text-sm tracking-widest text-[var(--highlight)]">
                        <span className="sr-only">
                          {review.rating} out of 5
                        </span>
                        <span aria-hidden="true">{stars}</span>
                      </p>
                    ) : null}
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-[var(--foreground)]">
                  {review.body}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
