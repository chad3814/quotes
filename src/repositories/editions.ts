import { eq } from "drizzle-orm";
import type { Database } from "@/db/types";
import type { EditionFormat } from "@/db/schema";
import { editions } from "@/db/schema";

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
