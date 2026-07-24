import { asc, eq } from "drizzle-orm";
import type { Database } from "@/db/types";
import type { EditionFormat } from "@/db/schema";
import { editions, works } from "@/db/schema";

export type CreateEditionInput = {
  workId: string;
  format: EditionFormat;
  label?: string;
  language?: string;
  releaseDate?: string;
  runtimeMs?: number;
  pageCount?: number;
};

export async function createEdition(db: Database, input: CreateEditionInput): Promise<{ id: string }> {
  const [row] = await db
    .insert(editions)
    .values({
      workId: input.workId,
      format: input.format,
      label: input.label ?? null,
      language: input.language ?? null,
      releaseDate: input.releaseDate ?? null,
      runtimeMs: input.runtimeMs ?? null,
      pageCount: input.pageCount ?? null,
    })
    .returning({ id: editions.id });
  return row;
}

export type UpdateEditionFields = {
  format?: EditionFormat;
  runtimeMs?: number | null;
  language?: string | null;
  releaseDate?: string | null;
};

export async function updateEdition(db: Database, id: string, fields: UpdateEditionFields): Promise<void> {
  await db.update(editions).set({ ...fields, updatedAt: new Date() }).where(eq(editions.id, id));
}

export type AdminEditionOption = {
  id: string;
  format: EditionFormat;
  label: string | null;
  workTitle: string;
  workYear: number | null;
};

/** All editions with their work title/year, for the admin "add quote" edition picker. */
export async function listEditionsForAdmin(db: Database): Promise<AdminEditionOption[]> {
  return db
    .select({
      id: editions.id,
      format: editions.format,
      label: editions.label,
      workTitle: works.title,
      workYear: works.year,
    })
    .from(editions)
    .innerJoin(works, eq(works.id, editions.workId))
    .orderBy(asc(works.title), asc(editions.createdAt));
}
