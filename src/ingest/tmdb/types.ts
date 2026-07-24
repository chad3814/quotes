export type TmdbExternalIds = {
  imdb_id: string | null;
  wikidata_id: string | null;
};

export type TmdbMovie = {
  id: number;
  title: string;
  original_title: string;
  release_date: string | null;
  runtime: number | null;
  overview: string;
  original_language: string;
  poster_path?: string | null;
  external_ids: TmdbExternalIds;
};

export type TmdbSeasonSummary = { season_number: number };

export type TmdbSeries = {
  id: number;
  name: string;
  original_name: string;
  first_air_date: string | null;
  overview: string;
  seasons: TmdbSeasonSummary[];
  poster_path?: string | null;
  external_ids: TmdbExternalIds;
};

export type TmdbEpisode = {
  id: number;
  episode_number: number;
  season_number: number;
  name: string;
  overview: string;
  runtime: number | null;
  air_date: string | null;
  still_path?: string | null;
};

export type TmdbSeason = {
  season_number: number;
  episodes: TmdbEpisode[];
};

/** Raw item from `/search/movie`. */
export type TmdbMovieSearchItem = { id: number; title: string; release_date: string | null };
/** Raw item from `/search/tv`. */
export type TmdbTvSearchItem = { id: number; name: string; first_air_date: string | null };
export type TmdbSearchResponse<T> = { results: T[] };

/** Normalized search hit used by the admin title autocomplete. */
export type TmdbSearchResult = {
  id: number;
  title: string;
  year: number | null;
  mediaType: "movie" | "tv";
};

export interface TmdbClient {
  getMovie(id: number): Promise<TmdbMovie>;
  getSeries(id: number): Promise<TmdbSeries>;
  getSeason(seriesId: number, seasonNumber: number): Promise<TmdbSeason>;
  search(type: "movie" | "tv", query: string): Promise<TmdbSearchResult[]>;
}
