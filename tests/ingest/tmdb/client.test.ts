import { describe, expect, it, vi } from "vitest";
import { createTmdbClient, TmdbError } from "@/ingest/tmdb/client";

function jsonResponse<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("createTmdbClient", () => {
  it("throws when no credential is provided", () => {
    expect(() => createTmdbClient({ apiKey: undefined, token: undefined, fetchImpl: fetch })).toThrow();
  });

  it("sends a Bearer token and requests external_ids for a movie", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ id: 11, title: "Star Wars", external_ids: { imdb_id: "tt0076759", wikidata_id: "Q17738" } }));
    const client = createTmdbClient({ token: "TESTTOKEN", fetchImpl });
    const movie = await client.getMovie(11);
    expect(movie.id).toBe(11);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain("/movie/11");
    expect(String(url)).toContain("append_to_response=external_ids");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer TESTTOKEN");
  });

  it("retries once on HTTP 429 then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(jsonResponse({ id: 1399, name: "GoT", seasons: [], external_ids: { imdb_id: null, wikidata_id: null } }));
    const client = createTmdbClient({ token: "T", fetchImpl, retryBaseMs: 0 });
    const series = await client.getSeries(1399);
    expect(series.id).toBe(1399);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("throws TmdbError on a non-retryable error without leaking the api key", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 404 }));
    const client = createTmdbClient({ apiKey: "SECRETKEY", fetchImpl });
    await expect(client.getMovie(999)).rejects.toBeInstanceOf(TmdbError);
    await expect(client.getMovie(999)).rejects.not.toThrow(/SECRETKEY/);
  });

  it("normalizes movie search results (title + year + mediaType)", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({
        results: [
          { id: 11, title: "Star Wars", release_date: "1977-05-25" },
          { id: 12, title: "Untitled", release_date: null },
        ],
      }),
    );
    const client = createTmdbClient({ token: "T", fetchImpl });
    const results = await client.search("movie", "star wars");
    expect(results).toEqual([
      { id: 11, title: "Star Wars", year: 1977, mediaType: "movie" },
      { id: 12, title: "Untitled", year: null, mediaType: "movie" },
    ]);
    const [url] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain("/search/movie");
    expect(String(url)).toContain("query=star+wars");
  });

  it("normalizes tv search results using name + first_air_date", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ results: [{ id: 1399, name: "Game of Thrones", first_air_date: "2011-04-17" }] }),
    );
    const client = createTmdbClient({ token: "T", fetchImpl });
    const results = await client.search("tv", "thrones");
    expect(results).toEqual([{ id: 1399, title: "Game of Thrones", year: 2011, mediaType: "tv" }]);
    expect(String(fetchImpl.mock.calls[0][0])).toContain("/search/tv");
  });

  it("skips the request and returns [] for a blank query", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ results: [] }));
    const client = createTmdbClient({ token: "T", fetchImpl });
    expect(await client.search("movie", "   ")).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
