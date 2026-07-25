import { getDb } from "@/db/client";
import { getQuoteBySlug, getQuoteById } from "@/repositories/quotes";
import { serializeQuote } from "@/lib/quote-json";

export const dynamic = "force-dynamic";

/**
 * Returns a single quote as JSON, resolved by slug first (matching the site's
 * /quotes/<slug> URLs) then falling back to the internal id.
 * GET /api/quotes/<slug|id>
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ idOrSlug: string }> },
): Promise<Response> {
  const { idOrSlug } = await params;
  const db = getDb();

  const detail = (await getQuoteBySlug(db, idOrSlug)) ?? (await getQuoteById(db, idOrSlug));
  if (!detail) {
    return Response.json({ error: "Quote not found." }, { status: 404 });
  }

  const origin = new URL(request.url).origin;
  return Response.json(serializeQuote(detail, origin));
}
