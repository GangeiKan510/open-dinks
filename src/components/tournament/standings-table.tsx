import { formatDiff, type StandingRow } from "@/engine/tournament";
import { cn } from "@/lib/utils";

export function StandingsTable({
  title,
  rows,
  advanceCount,
  tone = "light",
}: {
  title: string;
  rows: StandingRow[];
  advanceCount: number;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border",
        dark
          ? "border-white/10 bg-white/5"
          : "border-[var(--border)] bg-[var(--surface)]",
      )}
    >
      <h3
        className={cn(
          "border-b px-4 py-3 font-[family-name:var(--font-display)] text-xl",
          dark ? "border-white/10" : "border-[var(--border)]",
        )}
      >
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead
            className={cn(
              "text-xs uppercase tracking-[0.14em]",
              dark ? "text-white/50" : "text-[var(--muted)]",
            )}
          >
            <tr>
              <th className="px-3 py-2 font-medium" scope="col">
                #
              </th>
              <th className="px-3 py-2 font-medium" scope="col">
                Team
              </th>
              {["W", "L", "PF", "PA", "+/-"].map((label) => (
                <th
                  key={label}
                  className="px-3 py-2 text-right font-medium"
                  scope="col"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const advances = row.rank <= advanceCount;
              return (
                <tr
                  key={row.teamId}
                  className={cn(
                    "border-t",
                    dark ? "border-white/10" : "border-[var(--border)]",
                    advances &&
                      (dark
                        ? "bg-[var(--lime)]/15"
                        : "bg-[var(--accent-soft)]"),
                  )}
                >
                  <td className="px-3 py-2 tabular-nums">{row.rank}</td>
                  <td className="max-w-[12rem] truncate px-3 py-2 font-medium">
                    {row.name}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.wins}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.losses}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.pointsFor}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.pointsAgainst}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatDiff(row.diff)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
