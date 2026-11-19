import { resolveFeatureAccess, type ClubStatus } from "@/lib/entitlements";

export type RosterUser = {
  id: string;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  provider: string | null;
};

export type RosterMembership = {
  userId: string;
  role: string;
  venueName: string;
  facilityId: string;
  timeZone: string;
};

export type RosterBilling = {
  facilityId: string;
  trialEndsAt: string | null;
  clubStatus: ClubStatus;
  clubPeriodEnd: string | null;
};

export type AccountKind = "operator" | "host" | "player" | "account";

export type AccountVenue = {
  name: string;
  role: string;
  plan: string;
};

export type AccountRow = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  lastSignInAt: string | null;
  kind: AccountKind;
  venues: AccountVenue[];
};

function planLabel(
  billing: RosterBilling | undefined,
  timeZone: string,
  now: Date,
): string {
  if (!billing) return "No plan";
  const access = resolveFeatureAccess({
    now,
    timeZone,
    trialEndsAt: billing.trialEndsAt,
    clubStatus: billing.clubStatus,
    clubPeriodEnd: billing.clubPeriodEnd,
    passes: [],
  });
  if (access.phase === "trial") {
    return access.trialDaysLeft === 1
      ? "Trial · 1 day"
      : `Trial · ${access.trialDaysLeft} days`;
  }
  if (access.phase === "active") return "Club month";
  return "Paused";
}

export function buildAccountRoster(input: {
  users: RosterUser[];
  names: { id: string; displayName: string }[];
  memberships: RosterMembership[];
  billing: RosterBilling[];
  operatorIds: string[];
  now: Date;
}): AccountRow[] {
  const names = new Map(input.names.map((row) => [row.id, row.displayName]));
  const operators = new Set(input.operatorIds);
  const billing = new Map(input.billing.map((row) => [row.facilityId, row]));
  const memberships = new Map<string, RosterMembership[]>();
  for (const membership of input.memberships) {
    const list = memberships.get(membership.userId) ?? [];
    list.push(membership);
    memberships.set(membership.userId, list);
  }

  const rows = input.users.map((user) => {
    const clubs = memberships.get(user.id) ?? [];
    const kind: AccountKind = operators.has(user.id)
      ? "operator"
      : clubs.length > 0
        ? "host"
        : user.provider === "google"
          ? "player"
          : "account";
    return {
      id: user.id,
      email: user.email ?? "",
      displayName: names.get(user.id)?.trim() || "Unnamed",
      createdAt: user.createdAt,
      lastSignInAt: user.lastSignInAt,
      kind,
      venues: clubs.map((club) => ({
        name: club.venueName,
        role: club.role,
        plan: planLabel(billing.get(club.facilityId), club.timeZone, input.now),
      })),
    };
  });

  const ranked = rows.map((row) => ({
    row,
    at: Date.parse(row.createdAt),
  }));
  ranked.sort((a, b) => {
    const aTime = Number.isNaN(a.at) ? 0 : a.at;
    const bTime = Number.isNaN(b.at) ? 0 : b.at;
    return bTime - aTime;
  });
  return ranked.map((entry) => entry.row);
}

export function rosterLimitNote(
  shown: number,
  total: number | null,
): string | null {
  if (total != null && total > shown) {
    return `Showing ${shown} of ${total} accounts.`;
  }
  return null;
}
