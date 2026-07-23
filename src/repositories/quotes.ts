import { eq } from "drizzle-orm";
import type { Database } from "@/db/types";
import type { AttributionRole, LineType } from "@/db/schema";
import { attributions, editions, lines, quotes } from "@/db/schema";
import { buildSearchText } from "@/lib/search-text";
import { quoteSlugBase } from "@/lib/slug";
import { validatePosition, type Position } from "@/lib/position";
import { validateSpan } from "@/lib/attribution";
import { ensureUniqueSlug } from "@/repositories/slug-util";

export type CreateAttributionInput = {
  characterId: string;
  role: AttributionRole;
  start?: number | null;
  end?: number | null;
};

export type CreateLineInput = {
  type: LineType;
  content: string;
  attributions?: CreateAttributionInput[];
};

export type CreateQuoteInput = {
  editionId: string;
  position?: Position;
  slugBase?: string;
  lines: CreateLineInput[];
};

export async function createQuote(db: Database, input: CreateQuoteInput): Promise<{ id: string; slug: string }> {
  if (input.lines.length === 0) throw new Error("a quote requires at least one line");

  for (const line of input.lines) {
    for (const attr of line.attributions ?? []) {
      const span = validateSpan(line.content, attr.start, attr.end);
      if (!span.ok) throw new Error(span.error);
    }
  }

  const edition = await db
    .select({ format: editions.format, runtimeMs: editions.runtimeMs, pageCount: editions.pageCount })
    .from(editions)
    .where(eq(editions.id, input.editionId))
    .limit(1);
  if (edition.length === 0) throw new Error(`edition not found: ${input.editionId}`);
  if (input.position) {
    const pos = validatePosition(input.position, edition[0]);
    if (!pos.ok) throw new Error(pos.error);
  }

  const ordered = input.lines.map((line, index) => ({ ...line, ordinal: index }));
  const searchText = buildSearchText(ordered);
  const base = input.slugBase ?? quoteSlugBase(ordered);
  const position = input.position ?? {};

  return db.transaction(async (tx) => {
    const slug = await ensureUniqueSlug(tx, "quotes", base);
    const [quote] = await tx
      .insert(quotes)
      .values({
        editionId: input.editionId,
        slug,
        searchText,
        startMs: position.startMs ?? null,
        endMs: position.endMs ?? null,
        chapter: position.chapter ?? null,
        page: position.page ?? null,
        percent: position.percent != null ? String(position.percent) : null,
        locationNote: position.locationNote ?? null,
      })
      .returning({ id: quotes.id, slug: quotes.slug });

    for (const line of ordered) {
      const [row] = await tx
        .insert(lines)
        .values({ quoteId: quote.id, ordinal: line.ordinal, type: line.type, content: line.content })
        .returning({ id: lines.id });
      for (const attr of line.attributions ?? []) {
        await tx.insert(attributions).values({
          lineId: row.id,
          characterId: attr.characterId,
          role: attr.role,
          start: attr.start ?? null,
          end: attr.end ?? null,
        });
      }
    }

    return quote;
  });
}

export type QuoteDetail = {
  id: string;
  slug: string;
  lines: {
    ordinal: number;
    type: LineType;
    content: string;
    attributions: {
      characterId: string;
      characterName: string;
      characterSlug: string;
      role: AttributionRole;
      start: number | null;
      end: number | null;
    }[];
  }[];
};

export async function getQuoteBySlug(db: Database, slug: string): Promise<QuoteDetail | null> {
  const quote = await db.query.quotes.findFirst({
    where: eq(quotes.slug, slug),
    with: {
      lines: {
        orderBy: (line, { asc }) => [asc(line.ordinal)],
        with: { attributions: { with: { character: true } } },
      },
    },
  });
  if (!quote) return null;

  return {
    id: quote.id,
    slug: quote.slug,
    lines: quote.lines.map((line) => ({
      ordinal: line.ordinal,
      type: line.type,
      content: line.content,
      attributions: line.attributions.map((attr) => ({
        characterId: attr.characterId,
        characterName: attr.character.name,
        characterSlug: attr.character.slug,
        role: attr.role,
        start: attr.start,
        end: attr.end,
      })),
    })),
  };
}
