import type { Database } from "@/db/types";
import type { IbdbClient } from "@/ingest/ibdb/types";
import type { IbdbInput } from "@/ingest/parse-input";
import { mapBook } from "@/ingest/ibdb/map-book";
import { createWork, updateWork } from "@/repositories/works";
import { createEdition, updateEdition } from "@/repositories/editions";
import { findEntityIdByRef, upsertExternalReference } from "@/repositories/external-references";

export type BookIngestSummary = {
  workId: string;
  workCreated: boolean;
  editionsCreated: number;
  editionsExisting: number;
};

/**
 * Ingests a book from IBDB into a BOOK work + its editions. Idempotent: the work
 * is keyed by its IBDB id and each edition by its ISBN (both via external
 * references), so re-ingesting updates rather than duplicates.
 */
export async function ingestBook(db: Database, ibdb: IbdbClient, input: IbdbInput): Promise<BookIngestSummary> {
  const book = input.kind === "isbn" ? await ibdb.getBookByIsbn(input.value) : await ibdb.getBookById(input.value);
  const mapped = mapBook(book);

  return db.transaction(async (tx) => {
    let workId = await findEntityIdByRef(tx, "WORK", "IBDB", mapped.workRef.externalId);
    const workCreated = workId === null;

    if (workId === null) {
      const created = await createWork(tx, {
        type: "BOOK",
        title: mapped.work.title,
        synopsis: mapped.work.synopsis ?? undefined,
        year: mapped.work.year ?? undefined,
        byline: mapped.work.byline,
        posterPath: mapped.work.posterPath,
      });
      workId = created.id;
    } else {
      await updateWork(tx, workId, {
        title: mapped.work.title,
        synopsis: mapped.work.synopsis,
        year: mapped.work.year,
        byline: mapped.work.byline,
        posterPath: mapped.work.posterPath,
      });
    }

    await upsertExternalReference(tx, {
      entityType: "WORK",
      entityId: workId,
      provider: "IBDB",
      externalId: mapped.workRef.externalId,
      url: mapped.workRef.url,
    });

    let editionsCreated = 0;
    let editionsExisting = 0;
    for (const edition of mapped.editions) {
      const existingId = await findEntityIdByRef(tx, "EDITION", "IBDB", edition.ref.externalId);
      if (existingId === null) {
        const created = await createEdition(tx, {
          workId,
          format: edition.format,
          releaseDate: edition.releaseDate ?? undefined,
        });
        await upsertExternalReference(tx, {
          entityType: "EDITION",
          entityId: created.id,
          provider: "IBDB",
          externalId: edition.ref.externalId,
          url: edition.ref.url,
        });
        editionsCreated += 1;
      } else {
        await updateEdition(tx, existingId, { format: edition.format, releaseDate: edition.releaseDate });
        editionsExisting += 1;
      }
    }

    return { workId, workCreated, editionsCreated, editionsExisting };
  });
}
