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

/**
 * True when the given GitHub id is present in the admin allowlist. Compares as
 * strings (GitHub ids are numeric but handled as strings throughout).
 */
export function isAdmin(githubId: string | null | undefined, raw = process.env.ADMIN_ACCOUNTS): boolean {
  if (!githubId) return false;
  return parseAdminAccounts(raw).has(githubId);
}
