import {
  formatCentavos,
  paymentAmountCentavos,
  saleKindLabel,
  type SaleKind,
} from "@/lib/admin-sales";

export function formatAdminWhen(iso: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export type ActivityItem = {
  id: string;
  at: string;
  title: string;
  detail: string;
};

export type ActivitySource = {
  profiles: { id: string; displayName: string; createdAt: string }[];
  venues: {
    id: string;
    name: string;
    createdAt: string;
    actorName: string;
  }[];
  sessions: {
    id: string;
    title: string;
    status: string;
    createdAt: string;
    venueName: string;
    actorName: string;
  }[];
  bookings: {
    id: string;
    name: string;
    status: string;
    source: string;
    createdAt: string;
    venueName: string;
  }[];
  coaching: {
    id: string;
    name: string;
    status: string;
    createdAt: string;
    venueName: string;
  }[];
  tournaments: { id: string; at: string; actorName: string }[];
  payments: {
    id: string;
    createdAt: string;
    facilityName: string;
    kind: SaleKind;
    amountCentavos: number | null;
  }[];
  feedback: { id: string; createdAt: string }[];
};

function sessionTitle(status: string): string {
  if (status === "live") return "Open play is live";
  if (status === "completed") return "Open play finished";
  return "Open play was created";
}

export function buildActivityFeed(
  source: ActivitySource,
  limit = 80,
): ActivityItem[] {
  const items: ActivityItem[] = [
    ...source.profiles.map((row) => ({
      id: `profile-${row.id}`,
      at: row.createdAt,
      title: "Account created",
      detail: row.displayName || "New account",
    })),
    ...source.venues.map((row) => ({
      id: `venue-${row.id}`,
      at: row.createdAt,
      title: "Venue created",
      detail: [row.name, row.actorName].filter(Boolean).join(" · "),
    })),
    ...source.sessions.map((row) => ({
      id: `session-${row.id}`,
      at: row.createdAt,
      title: sessionTitle(row.status),
      detail: [row.title, row.venueName, row.actorName]
        .filter(Boolean)
        .join(" · "),
    })),
    ...source.bookings.map((row) => ({
      id: `booking-${row.id}`,
      at: row.createdAt,
      title: row.source === "public" ? "Court requested" : "Court booked",
      detail: [row.name || "A player", row.venueName, row.status]
        .filter(Boolean)
        .join(" · "),
    })),
    ...source.coaching.map((row) => ({
      id: `coaching-${row.id}`,
      at: row.createdAt,
      title: "Coaching requested",
      detail: [row.name || "A player", row.venueName, row.status]
        .filter(Boolean)
        .join(" · "),
    })),
    ...source.tournaments.map((row) => ({
      id: `tournament-${row.id}`,
      at: row.at,
      title: "Tournament saved",
      detail: row.actorName,
    })),
    ...source.payments.map((row) => ({
      id: `payment-${row.id}`,
      at: row.createdAt,
      title: `Paid ${formatCentavos(paymentAmountCentavos(row))}`,
      detail: [saleKindLabel(row.kind), row.facilityName]
        .filter(Boolean)
        .join(" · "),
    })),
    ...source.feedback.map((row) => ({
      id: `feedback-${row.id}`,
      at: row.createdAt,
      title: "Anonymous feedback",
      detail: "No name attached",
    })),
  ];

  const ranked = items.map((item) => ({
    item,
    at: Date.parse(item.at),
  }));
  ranked.sort((a, b) => {
    const aTime = Number.isNaN(a.at) ? 0 : a.at;
    const bTime = Number.isNaN(b.at) ? 0 : b.at;
    return bTime - aTime;
  });
  return ranked.slice(0, Math.max(0, limit)).map((row) => row.item);
}
