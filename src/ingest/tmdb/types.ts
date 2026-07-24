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
};

export type TmdbSeason = {
  season_number: number;
  episodes: TmdbEpisode[];
};

export interface TmdbClient {
  getMovie(id: number): Promise<TmdbMovie>;
  getSeries(id: number): Promise<TmdbSeries>;
  getSeason(seriesId: number, seasonNumber: number): Promise<TmdbSeason>;
}
