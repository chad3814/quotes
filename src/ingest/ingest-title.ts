import type { Database } from "@/db/types";
import type { TmdbClient } from "@/ingest/tmdb/types";
import type { TmdbInput } from "@/ingest/parse-input";
import { mapEpisode, mapMovie, mapSeries } from "@/ingest/mappers";
import { upsertWork } from "@/ingest/upsert";

export type IngestSummary = {
  type: "movie" | "tv";
  workId: string;
  workCreated: boolean;
  episodesCreated: number;
  episodesUpdated: number;
};

export async function ingestTitle(db: Database, tmdb: TmdbClient, input: TmdbInput): Promise<IngestSummary> {
  if (input.type === "movie") {
    const movie = await tmdb.getMovie(input.id);
    const result = await db.transaction((tx) => upsertWork(tx, mapMovie(movie), null));
    return { type: "movie", workId: result.workId, workCreated: result.workCreated, episodesCreated: 0, episodesUpdated: 0 };
  }

  const series = await tmdb.getSeries(input.id);
  const seriesResult = await db.transaction((tx) => upsertWork(tx, mapSeries(series), null));

  let episodesCreated = 0;
  let episodesUpdated = 0;
  for (const seasonSummary of series.seasons) {
    const season = await tmdb.getSeason(input.id, seasonSummary.season_number);
    for (const episode of season.episodes) {
      const mapped = mapEpisode(series.id, episode);
      const result = await db.transaction((tx) => upsertWork(tx, mapped, seriesResult.workId));
      if (result.workCreated) episodesCreated += 1;
      else episodesUpdated += 1;
    }
  }

  return {
    type: "tv",
    workId: seriesResult.workId,
    workCreated: seriesResult.workCreated,
    episodesCreated,
    episodesUpdated,
  };
}
