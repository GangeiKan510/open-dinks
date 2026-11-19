import { formatAdminWhen } from "@/lib/admin-activity";
import { activityItems, loadActivity } from "@/lib/admin-server";
import { PanelHeading, PanelNote } from "@/components/admin/panel";

export const metadata = { title: "Activity" };

export default async function AdminActivityPage() {
  const activity = await loadActivity();
  const items = activity.ok ? activityItems(activity.data) : [];
  return (
    <>
      <PanelHeading
        title="Activity"
        body="Sessions, bookings, payments, and anonymous notes. Contact emails and phone numbers stay on the booking itself."
      />
      {!activity.ok ? <PanelNote>{activity.message}</PanelNote> : null}
      {activity.ok && items.length === 0 ? (
        <PanelNote>Nothing has happened yet.</PanelNote>
      ) : null}
      {items.length > 0 ? (
        <ol className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{item.title}</p>
                <time
                  className="text-xs text-[var(--muted)]"
                  dateTime={item.at}
                >
                  {formatAdminWhen(item.at)}
                </time>
              </div>
              {item.detail ? (
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {item.detail}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </>
  );
}
