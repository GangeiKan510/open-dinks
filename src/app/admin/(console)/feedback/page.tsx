import { toggleFeaturedFeedbackAction } from "@/app/actions/admin";
import { formatAdminWhen } from "@/lib/admin-activity";
import { ADMIN_ERROR_MESSAGES } from "@/lib/admin-messages";
import { loadFeedbackInbox } from "@/lib/admin-server";
import { ratingStars } from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import { PanelHeading, PanelNote } from "@/components/admin/panel";

export const metadata = { title: "Feedback" };

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string }>;
}) {
  const notice = (await searchParams)?.notice;
  const inbox = await loadFeedbackInbox();
  return (
    <>
      <PanelHeading
        title="Feedback"
        body="Each note has a club name. Feature one to show it on the site as a review."
      />
      {notice === "feature" ? (
        <PanelNote>{ADMIN_ERROR_MESSAGES.featureFailed}</PanelNote>
      ) : null}
      {!inbox.ok ? <PanelNote>{inbox.message}</PanelNote> : null}
      {inbox.ok && inbox.data.note ? (
        <PanelNote>{inbox.data.note}</PanelNote>
      ) : null}
      {inbox.ok && inbox.data.notes.length === 0 ? (
        <PanelNote>No notes yet. The form is on the home page.</PanelNote>
      ) : null}
      {inbox.ok ? (
        <ul className="space-y-3">
          {inbox.data.notes.map((note) => {
            const stars = ratingStars(note.rating);
            return (
              <li
                key={note.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    {note.authorName ? (
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {note.authorName}
                      </p>
                    ) : null}
                    <p className="text-xs text-[var(--muted)]">
                      {formatAdminWhen(note.createdAt)}
                      {note.featured ? " · Featured" : " · Hidden"}
                    </p>
                    {stars ? (
                      <p className="mt-1 text-sm tracking-widest text-[var(--highlight)]">
                        <span className="sr-only">{note.rating} out of 5</span>
                        <span aria-hidden="true">{stars}</span>
                      </p>
                    ) : null}
                    {note.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={note.logoUrl}
                        alt={note.authorName ? `${note.authorName} logo` : ""}
                        className="mt-3 h-12 w-12 rounded-md border border-[var(--border)] bg-[var(--surface-2)] object-contain"
                      />
                    ) : null}
                  </div>
                  <form action={toggleFeaturedFeedbackAction}>
                    <input type="hidden" name="id" value={note.id} />
                    <Button type="submit" variant="outline" size="sm">
                      {note.featured ? "Unfeature" : "Feature"}
                    </Button>
                  </form>
                </div>
                <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {note.body}
                </p>
              </li>
            );
          })}
        </ul>
      ) : null}
    </>
  );
}
