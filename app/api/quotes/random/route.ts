import { getDb } from "@/db/client";
import { getRandomQuote, getQuoteBySlug } from "@/repositories/quotes";
import { serializeQuote } from "@/lib/quote-json";

export const dynamic = "force-dynamic";

/**
 * Returns a single random quote as JSON.
 * GET /api/quotes/random
 */
export async function GET(request: Request): Promise<Response> {
  const db = getDb();
  const random = await getRandomQuote(db);
  if (!random) {
    return Response.json({ error: "No quotes available." }, { status: 404 });
  }

  // getRandomQuote returns a compact card; load the full detail for the payload.
  const detail = await getQuoteBySlug(db, random.slug);
  if (!detail) {
    return Response.json({ error: "No quotes available." }, { status: 404 });
  }

  const origin = new URL(request.url).origin;
  return Response.json(serializeQuote(detail, origin), {
    // A random pick must never be cached by clients or the CDN.
    headers: { "Cache-Control": "no-store" },
  });
}
