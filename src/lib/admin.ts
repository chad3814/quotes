/**
 * Parses ADMIN_ACCOUNTS — a comma-separated list of GitHub numeric user ids —
 * into a set of trimmed, non-empty id strings.
 */
export function parseAdminAccounts(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  );
}

export type AdminIdentity = {
  /** Numeric GitHub user id. */
  id?: string | null;
  /** GitHub login / username. */
  login?: string | null;
};

/**
 * True when the signed-in GitHub account is on the admin allowlist. ADMIN_ACCOUNTS
 * entries may be either numeric ids or usernames, so an account matches if its id
 * (exact) OR its login (case-insensitive) is listed.
 */
export function isAdmin(identity: AdminIdentity | null | undefined, raw = process.env.ADMIN_ACCOUNTS): boolean {
  const allowlist = parseAdminAccounts(raw);
  if (allowlist.size === 0 || !identity) return false;

  if (identity.id && allowlist.has(identity.id)) return true;

  if (identity.login) {
    const login = identity.login.toLowerCase();
    for (const entry of allowlist) {
      if (entry.toLowerCase() === login) return true;
    }
  }
  return false;
}
