import type { EditionFormat, ReferenceProvider, WorkType } from "@/db/schema";
import type { TmdbEpisode, TmdbExternalIds, TmdbMovie, TmdbSeries } from "@/ingest/tmdb/types";

export type MappedRef = { provider: ReferenceProvider; externalId: string; url: string };
export type MappedEdition = {
  format: EditionFormat;
  runtimeMs: number | null;
  language: string | null;
  releaseDate: string | null;
};
export type MappedWork = {
  tmdbId: number;
  tmdbUrl: string;
  work: {
    type: WorkType;
    title: string;
    originalTitle: string | null;
    year: number | null;
    seasonNumber: number | null;
    episodeNumber: number | null;
    synopsis: string | null;
    posterPath: string | null;
  };
  edition: MappedEdition | null;
  refs: MappedRef[];
};

function runtimeToMs(minutes: number | null): number | null {
  return minutes != null && minutes > 0 ? minutes * 60_000 : null;
}

function yearFromDate(date: string | null): number | null {
  if (!date) return null;
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) && year > 0 ? year : null;
}

function nullIfEmpty(value: string): string | null {
  return value.length > 0 ? value : null;
}

function externalIdRefs(ids: TmdbExternalIds): MappedRef[] {
  const refs: MappedRef[] = [];
  if (ids.imdb_id) refs.push({ provider: "IMDB", externalId: ids.imdb_id, url: `https://www.imdb.com/title/${ids.imdb_id}/` });
  if (ids.wikidata_id) refs.push({ provider: "WIKIDATA", externalId: ids.wikidata_id, url: `https://www.wikidata.org/wiki/${ids.wikidata_id}` });
  return refs;
}

export function mapMovie(movie: TmdbMovie): MappedWork {
  const tmdbUrl = `https://www.themoviedb.org/movie/${movie.id}`;
  return {
    tmdbId: movie.id,
    tmdbUrl,
    work: {
      type: "MOVIE",
      title: movie.title,
      originalTitle: nullIfEmpty(movie.original_title),
      year: yearFromDate(movie.release_date),
      seasonNumber: null,
      episodeNumber: null,
      synopsis: nullIfEmpty(movie.overview),
      posterPath: movie.poster_path ?? null,
    },
    edition: {
      format: "THEATRICAL",
      runtimeMs: runtimeToMs(movie.runtime),
      language: nullIfEmpty(movie.original_language),
      releaseDate: nullIfEmpty(movie.release_date ?? ""),
    },
    refs: [
      { provider: "TMDB", externalId: String(movie.id), url: tmdbUrl },
      ...externalIdRefs(movie.external_ids),
    ],
  };
}

export function mapSeries(series: TmdbSeries): MappedWork {
  const tmdbUrl = `https://www.themoviedb.org/tv/${series.id}`;
  return {
    tmdbId: series.id,
    tmdbUrl,
    work: {
      type: "TV_SERIES",
      title: series.name,
      originalTitle: nullIfEmpty(series.original_name),
      year: yearFromDate(series.first_air_date),
      seasonNumber: null,
      episodeNumber: null,
      synopsis: nullIfEmpty(series.overview),
      posterPath: series.poster_path ?? null,
    },
    edition: null,
    refs: [
      { provider: "TMDB", externalId: String(series.id), url: tmdbUrl },
      ...externalIdRefs(series.external_ids),
    ],
  };
}

export function mapEpisode(seriesTmdbId: number, episode: TmdbEpisode): MappedWork {
  const tmdbUrl = `https://www.themoviedb.org/tv/${seriesTmdbId}/season/${episode.season_number}/episode/${episode.episode_number}`;
  return {
    tmdbId: episode.id,
    tmdbUrl,
    work: {
      type: "TV_EPISODE",
      title: episode.name,
      originalTitle: null,
      year: yearFromDate(episode.air_date),
      seasonNumber: episode.season_number,
      episodeNumber: episode.episode_number,
      synopsis: nullIfEmpty(episode.overview),
      posterPath: episode.still_path ?? null,
    },
    edition: {
      format: "TV_BROADCAST",
      runtimeMs: runtimeToMs(episode.runtime),
      language: null,
      releaseDate: nullIfEmpty(episode.air_date ?? ""),
    },
    refs: [{ provider: "TMDB", externalId: String(episode.id), url: tmdbUrl }],
  };
}
