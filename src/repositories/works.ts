import { and, asc, count, eq, isNull } from "drizzle-orm";
import type { Database } from "@/db/types";
import type { EditionFormat, WorkType } from "@/db/schema";
import { editions, quotes, works } from "@/db/schema";
import { slugify } from "@/lib/slug";
import { quotePreview } from "@/lib/preview";
import { ensureUniqueSlug } from "@/repositories/slug-util";

export type CreateWorkInput = {
  type: WorkType;
  title: string;
  originalTitle?: string;
  parentWorkId?: string;
  year?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  synopsis?: string;
  slug?: string;
};

export async function createWork(db: Database, input: CreateWorkInput): Promise<{ id: string; slug: string }> {
  const slug = await ensureUniqueSlug(db, "works", input.slug ?? slugify(input.title));
  const [row] = await db
    .insert(works)
    .values({
      type: input.type,
      title: input.title,
      originalTitle: input.originalTitle ?? null,
      parentWorkId: input.parentWorkId ?? null,
      year: input.year ?? null,
      seasonNumber: input.seasonNumber ?? null,
      episodeNumber: input.episodeNumber ?? null,
      synopsis: input.synopsis ?? null,
      slug,
    })
    .returning({ id: works.id, slug: works.slug });
  return row;
}

export type WorkListItem = {
  id: string;
  type: WorkType;
  title: string;
  slug: string;
  year: number | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  quoteCount: number;
};

export type ListWorksOptions = {
  type?: WorkType;
  /** Restrict to child works of this work (e.g. episodes of a series). */
  parentId?: string;
  /** Restrict to top-level works (no parent) — movies, series, books. */
  topLevelOnly?: boolean;
  limit?: number;
  offset?: number;
};

/**
 * Lists works with an aggregate count of the quotes attached to their editions.
 * Ordered by season / episode / title so both a flat catalogue and a series'
 * episode list read naturally.
 */
export async function listWorks(db: Database, options: ListWorksOptions = {}): Promise<WorkListItem[]> {
  const conditions = [];
  if (options.type) conditions.push(eq(works.type, options.type));
  if (options.parentId) conditions.push(eq(works.parentWorkId, options.parentId));
  if (options.topLevelOnly) conditions.push(isNull(works.parentWorkId));

  return db
    .select({
      id: works.id,
      type: works.type,
      title: works.title,
      slug: works.slug,
      year: works.year,
      seasonNumber: works.seasonNumber,
      episodeNumber: works.episodeNumber,
      quoteCount: count(quotes.id),
    })
    .from(works)
    .leftJoin(editions, eq(editions.workId, works.id))
    .leftJoin(quotes, eq(quotes.editionId, editions.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(works.id)
    .orderBy(asc(works.seasonNumber), asc(works.episodeNumber), asc(works.title))
    .limit(options.limit ?? 500)
    .offset(options.offset ?? 0);
}

export type WorkPage = {
  id: string;
  type: WorkType;
  title: string;
  slug: string;
  year: number | null;
  synopsis: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  parent: { title: string; slug: string; type: WorkType } | null;
  children: WorkListItem[];
  editions: {
    id: string;
    format: EditionFormat;
    label: string | null;
    quotes: { id: string; slug: string; preview: string }[];
  }[];
};

export type UpdateWorkFields = {
  title?: string;
  originalTitle?: string | null;
  year?: number | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  synopsis?: string | null;
  parentWorkId?: string | null;
};

export async function updateWork(db: Database, id: string, fields: UpdateWorkFields): Promise<void> {
  await db.update(works).set({ ...fields, updatedAt: new Date() }).where(eq(works.id, id));
}

export async function getWorkBySlug(db: Database, slug: string): Promise<WorkPage | null> {
  const work = await db.query.works.findFirst({
    where: eq(works.slug, slug),
    with: {
      parent: true,
      editions: {
        orderBy: (t, { asc }) => [asc(t.createdAt), asc(t.id)],
        with: {
          quotes: {
            orderBy: (t, { asc }) => [asc(t.createdAt), asc(t.id)],
          },
        },
      },
    },
  });
  if (!work) return null;

  const children = await listWorks(db, { parentId: work.id });

  return {
    id: work.id,
    type: work.type,
    title: work.title,
    slug: work.slug,
    year: work.year,
    synopsis: work.synopsis,
    seasonNumber: work.seasonNumber,
    episodeNumber: work.episodeNumber,
    parent: work.parent
      ? { title: work.parent.title, slug: work.parent.slug, type: work.parent.type }
      : null,
    children,
    editions: work.editions.map((edition) => ({
      id: edition.id,
      format: edition.format,
      label: edition.label,
      quotes: edition.quotes.map((quote) => ({
        id: quote.id,
        slug: quote.slug,
        preview: quotePreview(quote.searchText),
      })),
    })),
  };
}
