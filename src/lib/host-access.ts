/**
 * Host console vs public booking sign-in.
 *
 * Email accounts are hosts the club created. Google sign-in on a booking page
 * is only for requesting a court or a lesson, unless that person is already a
 * member of a facility.
 */

export type HostIdentity = {
  app_metadata?: {
    provider?: string;
    providers?: string[];
  } | null;
  identities?: Array<{ provider?: string | null }> | null;
};

function authProviders(user: HostIdentity): Set<string> {
  const providers = new Set<string>();
  const meta = user.app_metadata;
  if (typeof meta?.provider === "string" && meta.provider) {
    providers.add(meta.provider);
  }
  for (const provider of meta?.providers ?? []) {
    if (typeof provider === "string" && provider) providers.add(provider);
  }
  for (const identity of user.identities ?? []) {
    if (typeof identity?.provider === "string" && identity.provider) {
      providers.add(identity.provider);
    }
  }
  return providers;
}

/** Google booking sign-in with no host email identity. */
export function isPublicBooker(user: HostIdentity): boolean {
  const providers = authProviders(user);
  return providers.has("google") && !providers.has("email");
}

/**
 * Venue members always host. Everyone else can open the dashboard except a
 * public booking account, which must not start a facility.
 */
export function canOpenHostDashboard(input: {
  isPublicBooker: boolean;
  hasVenue: boolean;
}): boolean {
  if (input.hasVenue) return true;
  return !input.isPublicBooker;
}
