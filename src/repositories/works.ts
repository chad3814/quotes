import type { Database } from "@/db/types";
import type { WorkType } from "@/db/schema";
import { works } from "@/db/schema";
import { slugify } from "@/lib/slug";
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
