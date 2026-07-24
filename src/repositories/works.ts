import { eq } from "drizzle-orm";
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

export type WorkPage = {
  id: string;
  type: WorkType;
  title: string;
  slug: string;
  year: number | null;
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

  return {
    id: work.id,
    type: work.type,
    title: work.title,
    slug: work.slug,
    year: work.year,
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
