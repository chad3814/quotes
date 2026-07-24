import { desc, eq, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/db/types";
import type { AttributionRole, EditionFormat, LineType, WorkType } from "@/db/schema";
import { attributions, editions, lines, quotes, works } from "@/db/schema";
import { buildSearchText } from "@/lib/search-text";
import { quoteSlugBase } from "@/lib/slug";
import { quotePreview } from "@/lib/preview";
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

type OrderedLine = CreateLineInput & { ordinal: number };

/** Rejects attribution spans that fall outside their line's content. */
function validateLineSpans(input: CreateLineInput[]): void {
  for (const line of input) {
    for (const attr of line.attributions ?? []) {
      const span = validateSpan(line.content, attr.start, attr.end);
      if (!span.ok) throw new Error(span.error);
    }
  }
}

/** Loads the position-validation context (format/runtime/pages) for an edition. */
async function requireEditionContext(db: Database, editionId: string) {
  const edition = await db
    .select({ format: editions.format, runtimeMs: editions.runtimeMs, pageCount: editions.pageCount })
    .from(editions)
    .where(eq(editions.id, editionId))
    .limit(1);
  if (edition.length === 0) throw new Error(`edition not found: ${editionId}`);
  return edition[0];
}

/** Writes a quote's lines and their attributions (assumes any prior lines are gone). */
async function insertLines(tx: Database, quoteId: string, ordered: OrderedLine[]): Promise<void> {
  for (const line of ordered) {
    const [row] = await tx
      .insert(lines)
      .values({ quoteId, ordinal: line.ordinal, type: line.type, content: line.content })
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
}

function positionColumns(position: Position) {
  return {
    startMs: position.startMs ?? null,
    endMs: position.endMs ?? null,
    chapter: position.chapter ?? null,
    page: position.page ?? null,
    percent: position.percent != null ? String(position.percent) : null,
    locationNote: position.locationNote ?? null,
  };
}

export async function createQuote(db: Database, input: CreateQuoteInput): Promise<{ id: string; slug: string }> {
  if (input.lines.length === 0) throw new Error("a quote requires at least one line");
  validateLineSpans(input.lines);

  const editionContext = await requireEditionContext(db, input.editionId);
  if (input.position) {
    const pos = validatePosition(input.position, editionContext);
    if (!pos.ok) throw new Error(pos.error);
  }

  const ordered: OrderedLine[] = input.lines.map((line, index) => ({ ...line, ordinal: index }));
  const searchText = buildSearchText(ordered);
  const base = input.slugBase ?? quoteSlugBase(ordered);
  const position = input.position ?? {};

  return db.transaction(async (tx) => {
    const slug = await ensureUniqueSlug(tx, "quotes", base);
    const [quote] = await tx
      .insert(quotes)
      .values({ editionId: input.editionId, slug, searchText, ...positionColumns(position) })
      .returning({ id: quotes.id, slug: quotes.slug });

    await insertLines(tx, quote.id, ordered);
    return quote;
  });
}

export type UpdateQuoteInput = {
  position?: Position;
  lines: CreateLineInput[];
};

/**
 * Replaces a quote's lines/attributions and position in place, recomputing its
 * search text. The slug is left untouched so the quote's URL stays stable, and
 * the edition (and therefore the source work) is not reassigned here.
 */
export async function updateQuote(db: Database, id: string, input: UpdateQuoteInput): Promise<{ id: string; slug: string }> {
  if (input.lines.length === 0) throw new Error("a quote requires at least one line");
  validateLineSpans(input.lines);

  const ordered: OrderedLine[] = input.lines.map((line, index) => ({ ...line, ordinal: index }));
  const searchText = buildSearchText(ordered);
  const position = input.position ?? {};

  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: quotes.id, slug: quotes.slug, editionId: quotes.editionId })
      .from(quotes)
      .where(eq(quotes.id, id))
      .limit(1);
    if (existing.length === 0) throw new Error(`quote not found: ${id}`);

    if (input.position) {
      const editionContext = await requireEditionContext(tx, existing[0].editionId);
      const pos = validatePosition(input.position, editionContext);
      if (!pos.ok) throw new Error(pos.error);
    }

    await tx
      .update(quotes)
      .set({ searchText, ...positionColumns(position), updatedAt: new Date() })
      .where(eq(quotes.id, id));
    await tx.delete(lines).where(eq(lines.quoteId, id));
    await insertLines(tx, id, ordered);

    return { id: existing[0].id, slug: existing[0].slug };
  });
}

export type QuotePosition = {
  startMs: number | null;
  endMs: number | null;
  chapter: string | null;
  page: number | null;
  percent: string | null;
  locationNote: string | null;
};

export type QuoteSource = {
  work: { id: string; title: string; slug: string; type: WorkType; year: number | null };
  edition: { id: string; format: EditionFormat; label: string | null };
};

export type QuoteDetail = {
  id: string;
  slug: string;
  position: QuotePosition;
  source: QuoteSource;
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

function loadQuoteDetail(db: Database, where: SQL) {
  return db.query.quotes.findFirst({
    where,
    with: {
      edition: { with: { work: true } },
      lines: {
        orderBy: (line, { asc }) => [asc(line.ordinal)],
        with: { attributions: { with: { character: true } } },
      },
    },
  });
}

type LoadedQuote = NonNullable<Awaited<ReturnType<typeof loadQuoteDetail>>>;

function mapQuoteDetail(quote: LoadedQuote): QuoteDetail {
  return {
    id: quote.id,
    slug: quote.slug,
    position: {
      startMs: quote.startMs,
      endMs: quote.endMs,
      chapter: quote.chapter,
      page: quote.page,
      percent: quote.percent,
      locationNote: quote.locationNote,
    },
    source: {
      work: {
        id: quote.edition.work.id,
        title: quote.edition.work.title,
        slug: quote.edition.work.slug,
        type: quote.edition.work.type,
        year: quote.edition.work.year,
      },
      edition: {
        id: quote.edition.id,
        format: quote.edition.format,
        label: quote.edition.label,
      },
    },
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

export async function getQuoteBySlug(db: Database, slug: string): Promise<QuoteDetail | null> {
  const quote = await loadQuoteDetail(db, eq(quotes.slug, slug));
  return quote ? mapQuoteDetail(quote) : null;
}

/** Loads a quote's full detail by id (for the admin editor), or null. */
export async function getQuoteById(db: Database, id: string): Promise<QuoteDetail | null> {
  const quote = await loadQuoteDetail(db, eq(quotes.id, id));
  return quote ? mapQuoteDetail(quote) : null;
}

export type QuoteCard = {
  id: string;
  slug: string;
  /** Flattened single-line snippet, for compact rows. */
  preview: string;
  /** Full multi-line text (newline-separated lines), for the homepage hero. */
  text: string;
  work: { title: string; slug: string; type: WorkType; year: number | null };
};

/** Most recently added quotes, with their source work, for the homepage. */
export async function listRecentQuotes(db: Database, limit = 12): Promise<QuoteCard[]> {
  const rows = await db
    .select({
      id: quotes.id,
      slug: quotes.slug,
      searchText: quotes.searchText,
      workTitle: works.title,
      workSlug: works.slug,
      workType: works.type,
      workYear: works.year,
    })
    .from(quotes)
    .innerJoin(editions, eq(editions.id, quotes.editionId))
    .innerJoin(works, eq(works.id, editions.workId))
    .orderBy(desc(quotes.createdAt), desc(quotes.id))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    preview: quotePreview(row.searchText),
    text: row.searchText,
    work: { title: row.workTitle, slug: row.workSlug, type: row.workType, year: row.workYear },
  }));
}

/** A single random quote with its source work, for the homepage hero. Null if empty. */
export async function getRandomQuote(db: Database): Promise<QuoteCard | null> {
  const rows = await db
    .select({
      id: quotes.id,
      slug: quotes.slug,
      searchText: quotes.searchText,
      workTitle: works.title,
      workSlug: works.slug,
      workType: works.type,
      workYear: works.year,
    })
    .from(quotes)
    .innerJoin(editions, eq(editions.id, quotes.editionId))
    .innerJoin(works, eq(works.id, editions.workId))
    .orderBy(sql`random()`)
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    preview: quotePreview(row.searchText),
    text: row.searchText,
    work: { title: row.workTitle, slug: row.workSlug, type: row.workType, year: row.workYear },
  };
}
