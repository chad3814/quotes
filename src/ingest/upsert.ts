import type { Database } from "@/db/types";
import type { MappedWork } from "@/ingest/mappers";
import { createWork, updateWork } from "@/repositories/works";
import { createEdition, updateEdition } from "@/repositories/editions";
import { findEntityIdByRef, upsertExternalReference } from "@/repositories/external-references";

export type UpsertResult = { workId: string; workCreated: boolean; editionCreated: boolean };

// Idempotency here assumes a single writer: the create-then-insert-ref sequence below is not
// guarded by a DB uniqueness constraint on the TMDB id itself, so two concurrent ingests of the
// same title could each pass the findEntityIdByRef check and create a duplicate work row before
// either one writes its keying ref. The CLI is single-process/manual, so this is an accepted
// assumption rather than a bug to fix now.
export async function upsertWork(db: Database, mapped: MappedWork, parentWorkId: string | null): Promise<UpsertResult> {
  const tmdbId = String(mapped.tmdbId);
  const w = mapped.work;

  let workId = await findEntityIdByRef(db, "WORK", "TMDB", tmdbId);
  const workCreated = workId === null;

  if (workId === null) {
    const created = await createWork(db, {
      type: w.type,
      title: w.title,
      originalTitle: w.originalTitle ?? undefined,
      parentWorkId: parentWorkId ?? undefined,
      year: w.year ?? undefined,
      seasonNumber: w.seasonNumber ?? undefined,
      episodeNumber: w.episodeNumber ?? undefined,
      synopsis: w.synopsis ?? undefined,
      posterPath: w.posterPath,
    });
    workId = created.id;
  } else {
    await updateWork(db, workId, {
      title: w.title,
      originalTitle: w.originalTitle,
      year: w.year,
      seasonNumber: w.seasonNumber,
      episodeNumber: w.episodeNumber,
      synopsis: w.synopsis,
      posterPath: w.posterPath,
      parentWorkId,
    });
  }

  for (const ref of mapped.refs) {
    await upsertExternalReference(db, {
      entityType: "WORK",
      entityId: workId,
      provider: ref.provider,
      externalId: ref.externalId,
      url: ref.url,
    });
  }

  let editionCreated = false;
  if (mapped.edition) {
    let editionId = await findEntityIdByRef(db, "EDITION", "TMDB", tmdbId);
    if (editionId === null) {
      const created = await createEdition(db, {
        workId,
        format: mapped.edition.format,
        runtimeMs: mapped.edition.runtimeMs ?? undefined,
        language: mapped.edition.language ?? undefined,
        releaseDate: mapped.edition.releaseDate ?? undefined,
      });
      editionId = created.id;
      editionCreated = true;
      await upsertExternalReference(db, {
        entityType: "EDITION",
        entityId: editionId,
        provider: "TMDB",
        externalId: tmdbId,
        url: mapped.tmdbUrl,
      });
    } else {
      await updateEdition(db, editionId, mapped.edition);
    }
  }

  return { workId, workCreated, editionCreated };
}
