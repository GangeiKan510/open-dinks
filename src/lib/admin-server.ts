import { buildActivityFeed, type ActivitySource } from "@/lib/admin-activity";
import {
  buildAccountRoster,
  rosterLimitNote,
  type AccountRow,
  type RosterBilling,
  type RosterMembership,
  type RosterUser,
} from "@/lib/admin-roster";
import { ADMIN_ERROR_MESSAGES } from "@/lib/admin-messages";
import {
  summarizeSales,
  type SaleKind,
  type SaleRecord,
  type SalesSummary,
} from "@/lib/admin-sales";
import { isLocalSite, isSupabaseConfigured } from "@/lib/env";
import { type ClubStatus } from "@/lib/entitlements";
import { feedbackLogoSrc } from "@/lib/feedback";
import { PAYMENT_PROOF_BUCKET } from "@/lib/payment-proof";
import { type OperatorBootstrap } from "@/lib/operator-access";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/service";

type ServiceClient = ReturnType<typeof createServiceClient>;

export type OperatorGate =
  | { ok: true; userId: string; email: string }
  | { ok: false; reason: "signed-out" | "forbidden" };

export type { OperatorBootstrap };

export type PanelResult<T> =
  { ok: true; data: T } | { ok: false; message: string };

const PAGE_SIZE = 1000;
const MAX_PAGES = 5;
const ACTIVITY_ROWS = 40;
const ROSTER_PAGE = 200;

function isSaleKind(value: string): value is SaleKind {
  return value === "club" || value === "day" || value === "weekend";
}

function isClubStatus(value: string): value is ClubStatus {
  return (
    value === "none" ||
    value === "active" ||
    value === "past_due" ||
    value === "canceled"
  );
}

function serviceOrMessage(): ServiceClient | PanelResult<never> {
  if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
    return { ok: false, message: ADMIN_ERROR_MESSAGES.unconfigured };
  }
  return createServiceClient();
}

function asService(
  value: ServiceClient | PanelResult<never>,
): value is ServiceClient {
  return typeof value === "object" && value !== null && "from" in value;
}

async function loadPages<T>(
  label: string,
  load: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: T[] | null;
    error: { code?: string; message?: string } | null;
    count: number | null;
  }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const result = await load(from, from + PAGE_SIZE - 1);
    if (result.error) {
      if (isMissingSchemaError(result.error)) {
        throw new Error("schema");
      }
      console.error(`[admin] ${label} failed`, result.error.code);
      throw new Error("query");
    }
    rows.push(...(result.data ?? []));
    if (result.count == null || rows.length >= result.count) return rows;
  }
  console.error(`[admin] ${label} truncated`);
  throw new Error("truncated");
}

export async function requireOperator(): Promise<OperatorGate> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "signed-out" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "signed-out" };
  const { data, error } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error && !isMissingSchemaError(error)) {
    console.error("[admin] operator check failed", error.code);
  }
  if (error || !data) return { ok: false, reason: "forbidden" };
  return { ok: true, userId: user.id, email: user.email ?? "" };
}

export async function loadOperatorBootstrap(): Promise<OperatorBootstrap> {
  if (!isServiceRoleConfigured()) {
    return { mode: "unconfigured", reason: "service" };
  }
  const service = createServiceClient();
  const { count, error } = await service
    .from("platform_admins")
    .select("user_id", { count: "exact", head: true });
  if (error) {
    if (!isMissingSchemaError(error)) {
      console.error("[admin] roster count failed", error.code);
    }
    return { mode: "unconfigured", reason: "schema" };
  }
  if ((count ?? 0) > 0) return { mode: "closed" };
  if (isLocalSite()) return { mode: "local" };
  if ((process.env.PLATFORM_ADMIN_SETUP_KEY ?? "").trim().length >= 8) {
    return { mode: "key" };
  }
  return { mode: "unconfigured", reason: "key" };
}

export async function countOperators(): Promise<number | null> {
  if (!isServiceRoleConfigured()) return null;
  const service = createServiceClient();
  const { count, error } = await service
    .from("platform_admins")
    .select("user_id", { count: "exact", head: true });
  if (error) return null;
  return count ?? 0;
}

function panelError(error: unknown, fallback: string): PanelResult<never> {
  if (error instanceof Error && error.message === "schema") {
    return { ok: false, message: ADMIN_ERROR_MESSAGES.missingSchema };
  }
  return { ok: false, message: fallback };
}

export async function loadSales(): Promise<
  PanelResult<{ summary: SalesSummary; recent: SaleRecord[] }>
> {
  const service = serviceOrMessage();
  if (!asService(service)) return service;
  try {
    const [payments, facilities] = await Promise.all([
      loadPages("payments", (from, to) =>
        service
          .from("paymongo_payments")
          .select(
            "checkout_id, facility_id, kind, amount_centavos, created_at",
            {
              count: "exact",
            },
          )
          .order("created_at", { ascending: false })
          .range(from, to),
      ),
      loadPages("facilities", (from, to) =>
        service
          .from("facilities")
          .select("id, name", { count: "exact" })
          .range(from, to),
      ),
    ]);
    const names = new Map(facilities.map((row) => [row.id, row.name]));
    const sales: SaleRecord[] = [];
    for (const row of payments) {
      if (!isSaleKind(row.kind)) continue;
      sales.push({
        checkoutId: row.checkout_id,
        facilityName: names.get(row.facility_id) ?? "Club",
        kind: row.kind,
        amountCentavos: row.amount_centavos,
        createdAt: row.created_at,
      });
    }
    return {
      ok: true,
      data: {
        summary: summarizeSales(sales, new Date()),
        recent: sales.slice(0, 20),
      },
    };
  } catch (error) {
    return panelError(error, ADMIN_ERROR_MESSAGES.salesFailed);
  }
}

export async function loadRoster(): Promise<
  PanelResult<{ rows: AccountRow[]; note: string | null }>
> {
  const service = serviceOrMessage();
  if (!asService(service)) return service;
  try {
    const listed = await service.auth.admin.listUsers({
      page: 1,
      perPage: ROSTER_PAGE,
    });
    if (listed.error) {
      console.error("[admin] accounts failed", listed.error.code);
      return { ok: false, message: ADMIN_ERROR_MESSAGES.rosterFailed };
    }
    const users = listed.data.users ?? [];
    const total =
      "total" in listed.data && typeof listed.data.total === "number"
        ? listed.data.total
        : null;

    const [memberships, venues, billing, operators, profiles] =
      await Promise.all([
        loadPages("memberships", (from, to) =>
          service
            .from("venue_members")
            .select("user_id, role, venue_id", { count: "exact" })
            .range(from, to),
        ),
        loadPages("venues", (from, to) =>
          service
            .from("venues")
            .select("id, name, facility_id, timezone", { count: "exact" })
            .range(from, to),
        ),
        loadPages("billing", (from, to) =>
          service
            .from("facility_billing")
            .select(
              "facility_id, trial_ends_at, club_status, club_period_end, choice_made_at",
              {
                count: "exact",
              },
            )
            .range(from, to),
        ),
        loadPages("operators", (from, to) =>
          service
            .from("platform_admins")
            .select("user_id", { count: "exact" })
            .range(from, to),
        ),
        loadPages("profiles", (from, to) =>
          service
            .from("profiles")
            .select("id, display_name", { count: "exact" })
            .range(from, to),
        ),
      ]);

    const venueById = new Map(venues.map((row) => [row.id, row]));
    const rosterUsers: RosterUser[] = users.map((user) => ({
      id: user.id,
      email: user.email ?? null,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at ?? null,
      provider:
        typeof user.app_metadata?.provider === "string"
          ? user.app_metadata.provider
          : null,
    }));
    const rosterMemberships: RosterMembership[] = [];
    for (const membership of memberships) {
      const venue = venueById.get(membership.venue_id);
      if (!venue) continue;
      rosterMemberships.push({
        userId: membership.user_id,
        role: membership.role,
        venueName: venue.name,
        facilityId: venue.facility_id,
        timeZone: venue.timezone || "Asia/Manila",
      });
    }
    const rosterBilling: RosterBilling[] = billing.flatMap((row) => {
      if (!isClubStatus(row.club_status)) return [];
      return [
        {
          facilityId: row.facility_id,
          trialEndsAt: row.trial_ends_at,
          clubStatus: row.club_status,
          clubPeriodEnd: row.club_period_end,
          choiceMade: row.choice_made_at != null,
        },
      ];
    });

    return {
      ok: true,
      data: {
        rows: buildAccountRoster({
          users: rosterUsers,
          names: profiles.map((row) => ({
            id: row.id,
            displayName: row.display_name,
          })),
          memberships: rosterMemberships,
          billing: rosterBilling,
          operatorIds: operators.map((row) => row.user_id),
          now: new Date(),
        }),
        note: rosterLimitNote(users.length, total),
      },
    };
  } catch (error) {
    return panelError(error, ADMIN_ERROR_MESSAGES.rosterFailed);
  }
}

export async function loadActivity(): Promise<PanelResult<ActivitySource>> {
  const service = serviceOrMessage();
  if (!asService(service)) return service;
  try {
    const [
      profiles,
      venueNames,
      venues,
      sessions,
      bookings,
      coaching,
      tournaments,
      payments,
      feedback,
      facilities,
    ] = await Promise.all([
      service
        .from("profiles")
        .select("id, display_name, created_at")
        .order("created_at", { ascending: false })
        .limit(ACTIVITY_ROWS),
      service.from("venues").select("id, name"),
      service
        .from("venues")
        .select("id, name, created_by, created_at")
        .order("created_at", { ascending: false })
        .limit(ACTIVITY_ROWS),
      service
        .from("sessions")
        .select("id, title, status, created_at, venue_id, created_by")
        .order("created_at", { ascending: false })
        .limit(ACTIVITY_ROWS),
      service
        .from("bookings")
        .select("id, booked_by_name, status, source, created_at, venue_id")
        .order("created_at", { ascending: false })
        .limit(ACTIVITY_ROWS),
      service
        .from("coaching_bookings")
        .select("id, booked_by_name, status, created_at, venue_id")
        .order("created_at", { ascending: false })
        .limit(ACTIVITY_ROWS),
      service
        .from("tournaments")
        .select("id, created_by, updated_at")
        .order("updated_at", { ascending: false })
        .limit(ACTIVITY_ROWS),
      service
        .from("paymongo_payments")
        .select("checkout_id, facility_id, kind, amount_centavos, created_at")
        .order("created_at", { ascending: false })
        .limit(ACTIVITY_ROWS),
      service
        .from("feedback")
        .select("id, created_at")
        .order("created_at", { ascending: false })
        .limit(ACTIVITY_ROWS),
      service.from("facilities").select("id, name"),
    ]);

    const results = [
      venueNames,
      profiles,
      venues,
      sessions,
      bookings,
      coaching,
      tournaments,
      payments,
      feedback,
      facilities,
    ];
    if (results.some((result) => isMissingSchemaError(result.error))) {
      return { ok: false, message: ADMIN_ERROR_MESSAGES.missingSchema };
    }
    for (const result of results) {
      if (result.error) {
        console.error("[admin] activity failed", result.error.code);
        return { ok: false, message: ADMIN_ERROR_MESSAGES.activityFailed };
      }
    }

    const actorIds = [
      ...(venues.data ?? []).map((row) => row.created_by),
      ...(sessions.data ?? []).map((row) => row.created_by),
      ...(tournaments.data ?? []).map((row) => row.created_by),
    ].filter((id): id is string => Boolean(id));
    const { data: actors, error: actorError } =
      actorIds.length === 0
        ? { data: [], error: null }
        : await service
            .from("profiles")
            .select("id, display_name")
            .in("id", [...new Set(actorIds)].slice(0, 100));
    if (actorError) {
      console.error("[admin] activity names failed", actorError.code);
    }
    const actorName = new Map(
      (actors ?? []).map((row) => [row.id, row.display_name]),
    );
    const venueName = new Map(
      (venueNames.data ?? []).map((row) => [row.id, row.name]),
    );
    const facilityName = new Map(
      (facilities.data ?? []).map((row) => [row.id, row.name]),
    );

    const source: ActivitySource = {
      profiles: (profiles.data ?? []).map((row) => ({
        id: row.id,
        displayName: row.display_name,
        createdAt: row.created_at,
      })),
      venues: (venues.data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        createdAt: row.created_at,
        actorName: row.created_by ? (actorName.get(row.created_by) ?? "") : "",
      })),
      sessions: (sessions.data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        createdAt: row.created_at,
        venueName: venueName.get(row.venue_id) ?? "",
        actorName: row.created_by ? (actorName.get(row.created_by) ?? "") : "",
      })),
      bookings: (bookings.data ?? []).map((row) => ({
        id: row.id,
        name: row.booked_by_name,
        status: row.status,
        source: row.source,
        createdAt: row.created_at,
        venueName: venueName.get(row.venue_id) ?? "",
      })),
      coaching: (coaching.data ?? []).map((row) => ({
        id: row.id,
        name: row.booked_by_name,
        status: row.status,
        createdAt: row.created_at,
        venueName: venueName.get(row.venue_id) ?? "",
      })),
      tournaments: (tournaments.data ?? []).map((row) => ({
        id: row.id,
        at: row.updated_at,
        actorName: actorName.get(row.created_by) ?? "",
      })),
      payments: (payments.data ?? []).flatMap((row) => {
        if (!isSaleKind(row.kind)) return [];
        return [
          {
            id: row.checkout_id,
            createdAt: row.created_at,
            facilityName: facilityName.get(row.facility_id) ?? "Club",
            kind: row.kind,
            amountCentavos: row.amount_centavos,
          },
        ];
      }),
      feedback: (feedback.data ?? []).map((row) => ({
        id: row.id,
        createdAt: row.created_at,
      })),
    };
    return { ok: true, data: source };
  } catch (error) {
    return panelError(error, ADMIN_ERROR_MESSAGES.activityFailed);
  }
}

export type FeedbackNote = {
  id: string;
  body: string;
  rating: number | null;
  logoUrl: string | null;
  authorName: string | null;
  featured: boolean;
  createdAt: string;
};

export async function loadFeedbackInbox(): Promise<
  PanelResult<{ notes: FeedbackNote[]; note: string | null }>
> {
  const service = serviceOrMessage();
  if (!asService(service)) return service;
  try {
    const { data, error, count } = await service
      .from("feedback")
      .select("id, body, author_name, rating, logo_url, featured, created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      if (isMissingSchemaError(error)) {
        return { ok: false, message: ADMIN_ERROR_MESSAGES.missingSchema };
      }
      console.error("[admin] feedback failed", error.code);
      return { ok: false, message: ADMIN_ERROR_MESSAGES.feedbackFailed };
    }
    const notes = (data ?? []).map((row) => ({
      id: row.id,
      body: row.body,
      rating: row.rating,
      logoUrl: feedbackLogoSrc(row.id, row.logo_url),
      authorName: row.author_name,
      featured: row.featured,
      createdAt: row.created_at,
    }));
    return {
      ok: true,
      data: {
        notes,
        note: rosterLimitNote(notes.length, count),
      },
    };
  } catch (error) {
    return panelError(error, ADMIN_ERROR_MESSAGES.feedbackFailed);
  }
}

export function activityItems(source: ActivitySource, limit = 80) {
  return buildActivityFeed(source, limit);
}

export type PaymentProofReview = {
  id: string;
  facilityName: string;
  kind: "club" | "day";
  amountCentavos: number;
  dates: string | null;
  discountCode: string | null;
  createdAt: string;
  receiptUrl: string | null;
};

export async function loadPaymentProofs(): Promise<
  PanelResult<PaymentProofReview[]>
> {
  const service = serviceOrMessage();
  if (!asService(service)) return service;
  const { data, error } = await service
    .from("manual_payment_proofs")
    .select(
      "id, facility_id, kind, amount_centavos, discount_code, dates, storage_path, created_at",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) {
    if (isMissingSchemaError(error)) {
      return { ok: false, message: ADMIN_ERROR_MESSAGES.missingSchema };
    }
    console.error("[admin] receipts failed", error.code);
    return { ok: false, message: ADMIN_ERROR_MESSAGES.paymentsFailed };
  }
  const rows = data ?? [];
  const facilityIds = [...new Set(rows.map((row) => row.facility_id))];
  const names = new Map<string, string>();
  if (facilityIds.length > 0) {
    const facilities = await service
      .from("facilities")
      .select("id, name")
      .in("id", facilityIds);
    if (facilities.error) {
      console.error("[admin] receipt clubs failed", facilities.error.code);
      return { ok: false, message: ADMIN_ERROR_MESSAGES.paymentsFailed };
    }
    for (const facility of facilities.data ?? []) {
      names.set(facility.id, facility.name);
    }
  }

  const reviews: PaymentProofReview[] = [];
  for (const row of rows) {
    if (row.kind !== "club" && row.kind !== "day") continue;
    const signed = await service.storage
      .from(PAYMENT_PROOF_BUCKET)
      .createSignedUrl(row.storage_path, 60 * 15);
    reviews.push({
      id: row.id,
      facilityName: names.get(row.facility_id) ?? "Club",
      kind: row.kind,
      amountCentavos: row.amount_centavos,
      dates: row.dates,
      discountCode: row.discount_code,
      createdAt: row.created_at,
      receiptUrl: signed.data?.signedUrl ?? null,
    });
  }
  return { ok: true, data: reviews };
}
