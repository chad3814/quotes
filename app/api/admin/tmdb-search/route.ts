import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { createTmdbClient } from "@/ingest/tmdb/client";

export const dynamic = "force-dynamic";

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 8;

/**
 * Admin-only TMDb typeahead for the "add work" title autocomplete.
 * GET /api/admin/tmdb-search?type=movie|tv&q=<query>
 */
export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!isAdmin({ id: session?.user?.githubId, login: session?.user?.githubLogin })) {
    return Response.json({ error: "unauthorized" }, { status: 403 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const type = url.searchParams.get("type") === "tv" ? "tv" : "movie";

  if (query.trim().length < MIN_QUERY_LENGTH) {
    return Response.json({ results: [] });
  }

  try {
    const tmdb = createTmdbClient();
    const results = await tmdb.search(type, query);
    return Response.json({ results: results.slice(0, MAX_RESULTS) });
  } catch {
    // Never surface TMDb internals (which could echo the api key) to the client.
    return Response.json({ error: "TMDb search failed." }, { status: 502 });
  }
}
