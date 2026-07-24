import type {
  TmdbClient,
  TmdbMovie,
  TmdbMovieSearchItem,
  TmdbSearchResponse,
  TmdbSearchResult,
  TmdbSeason,
  TmdbSeries,
  TmdbTvSearchItem,
} from "@/ingest/tmdb/types";

export type TmdbClientOptions = {
  token?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  maxRetries?: number;
  retryBaseMs?: number;
};

export class TmdbError extends Error {
  readonly status: number;
  constructor(status: number, path: string) {
    super(`TMDB request failed (${status}) for ${path}`);
    this.name = "TmdbError";
    this.status = status;
  }
}

const DEFAULT_BASE = "https://api.themoviedb.org/3";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function yearFromDate(date: string | null | undefined): number | null {
  if (!date) return null;
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) && year > 0 ? year : null;
}

export function createTmdbClient(options: TmdbClientOptions = {}): TmdbClient {
  const token = options.token ?? process.env.TMDB_READ_ACCESS_TOKEN;
  const apiKey = options.apiKey ?? process.env.TMDB_API_KEY;
  if (!token && !apiKey) {
    throw new Error("TMDB credentials not set (TMDB_READ_ACCESS_TOKEN or TMDB_API_KEY)");
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? DEFAULT_BASE;
  const maxRetries = options.maxRetries ?? 3;
  const retryBaseMs = options.retryBaseMs ?? 500;

  async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${baseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    if (!token && apiKey) url.searchParams.set("api_key", apiKey);
    const headers: Record<string, string> = { accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    for (let attempt = 0; ; attempt += 1) {
      const res = await fetchImpl(url, { headers });
      if (res.ok) return (await res.json()) as T;
      if (res.status === 429 && attempt < maxRetries) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : retryBaseMs * 2 ** attempt;
        await sleep(waitMs);
        continue;
      }
      // Note: `path`, never the URL — the URL may carry the api_key query param.
      throw new TmdbError(res.status, path);
    }
  }

  async function search(type: "movie" | "tv", query: string): Promise<TmdbSearchResult[]> {
    const trimmed = query.trim();
    if (trimmed === "") return [];
    if (type === "movie") {
      const data = await get<TmdbSearchResponse<TmdbMovieSearchItem>>("/search/movie", { query: trimmed });
      return data.results.map((r) => ({ id: r.id, title: r.title, year: yearFromDate(r.release_date), mediaType: "movie" }));
    }
    const data = await get<TmdbSearchResponse<TmdbTvSearchItem>>("/search/tv", { query: trimmed });
    return data.results.map((r) => ({ id: r.id, title: r.name, year: yearFromDate(r.first_air_date), mediaType: "tv" }));
  }

  return {
    getMovie: (id) => get<TmdbMovie>(`/movie/${id}`, { append_to_response: "external_ids" }),
    getSeries: (id) => get<TmdbSeries>(`/tv/${id}`, { append_to_response: "external_ids" }),
    getSeason: (seriesId, seasonNumber) => get<TmdbSeason>(`/tv/${seriesId}/season/${seasonNumber}`),
    search,
  };
}
