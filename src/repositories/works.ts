import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { Database } from "@/db/types";
import type { EditionFormat, WorkType } from "@/db/schema";
import { works } from "@/db/schema";
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
  posterPath?: string | null;
  byline?: string | null;
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
      posterPath: input.posterPath ?? null,
      byline: input.byline ?? null,
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
  /** Max rows; defaults to 500. Pass null for no limit (e.g. all episodes of a long series). */
  limit?: number | null;
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

  let query = db
    .select({
      id: works.id,
      type: works.type,
      title: works.title,
      slug: works.slug,
      year: works.year,
      seasonNumber: works.seasonNumber,
      episodeNumber: works.episodeNumber,
      // Quotes attributed to this work AND its child works (e.g. a series counts
      // every episode's quotes). Child works nest one level (series → episodes).
      quoteCount: sql<number>`(
        select count(*)::int
        from quotes q
        join editions e on e.id = q.edition_id
        join works cw on cw.id = e.work_id
        where cw.id = works.id or cw.parent_work_id = works.id
      )`,
    })
    .from(works)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(works.seasonNumber), asc(works.episodeNumber), asc(works.title))
    .$dynamic();

  // limit: null means "no limit"; undefined falls back to a safe default.
  if (options.limit !== null) query = query.limit(options.limit ?? 500);
  if (options.offset) query = query.offset(options.offset);

  return query;
}

export type WorkPage = {
  id: string;
  type: WorkType;
  title: string;
  slug: string;
  year: number | null;
  synopsis: string | null;
  posterPath: string | null;
  byline: string | null;
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
  posterPath?: string | null;
  byline?: string | null;
  parentWorkId?: string | null;
};

/**
 * Patches a work's editable fields. The slug is intentionally left untouched — a
 * title edit must not break the work's existing URL or inbound links.
 */
export async function updateWork(db: Database, id: string, fields: UpdateWorkFields): Promise<void> {
  await db.update(works).set({ ...fields, updatedAt: new Date() }).where(eq(works.id, id));
}

export type WorkEditData = {
  id: string;
  type: WorkType;
  title: string;
  originalTitle: string | null;
  slug: string;
  year: number | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  synopsis: string | null;
  parentWorkId: string | null;
};

/** Loads a work's raw editable fields by id (for the admin editor), or null. */
export async function getWorkById(db: Database, id: string): Promise<WorkEditData | null> {
  const row = await db.query.works.findFirst({ where: eq(works.id, id) });
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    originalTitle: row.originalTitle,
    slug: row.slug,
    year: row.year,
    seasonNumber: row.seasonNumber,
    episodeNumber: row.episodeNumber,
    synopsis: row.synopsis,
    parentWorkId: row.parentWorkId,
  };
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

  // No limit: a long-running series (e.g. The Simpsons, 800+ episodes) must list them all.
  const children = await listWorks(db, { parentId: work.id, limit: null });

  return {
    id: work.id,
    type: work.type,
    title: work.title,
    slug: work.slug,
    year: work.year,
    synopsis: work.synopsis,
    posterPath: work.posterPath,
    byline: work.byline,
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
