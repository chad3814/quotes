import type { WorkType } from "@/db/schema";
import type { TmdbInput } from "@/ingest/parse-input";

/**
 * Maps a work to the TMDb ingest input used to re-sync it, or null when the work
 * can't be re-synced from a top-level TMDb title. Only movies and TV series are
 * re-syncable; episodes are re-synced through their parent series, and books have
 * no TMDb source. Returns null for a non-numeric / non-positive external id.
 */
export function tmdbInputForWork(type: WorkType, externalId: string): TmdbInput | null {
  const id = Number(externalId);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (type === "MOVIE") return { type: "movie", id };
  if (type === "TV_SERIES") return { type: "tv", id };
  return null;
}
