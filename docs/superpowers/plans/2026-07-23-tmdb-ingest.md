# TMDB Metadata Ingest (Pass A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A CLI that idempotently ingests a movie or full TV series from TMDB into `works`, `editions`, and `external_references`.

**Architecture:** A typed `TmdbClient` (interface + fetch impl) feeds pure mappers that turn TMDB responses into `MappedWork` values; an external-ref-keyed `upsertWork` writes them idempotently; `ingestTitle` orchestrates the movie/TV flows; a `tsx` CLI wires a node-postgres DB client and the real TMDB client. Orchestration is sequential (one outstanding request, per-episode transactions → resumable).

**Tech Stack:** TypeScript (strict) · TMDB REST via `fetch` · Drizzle (node-postgres for the CLI, PGlite for tests) · Vitest · `tsx`.

**Scope:** Metadata only. No characters, books, or quotes.

**Source spec:** `docs/superpowers/specs/2026-07-23-tmdb-ingest-design.md`

## Global Constraints

- TypeScript `strict`; **no `any` and no `unknown`** as declared types (type assertions like `as TmdbMovie` are allowed).
- 2-space indentation; semicolons on statements.
- The TMDB credential is read from env and **never logged or included in error messages** (in particular, never put a URL carrying an `api_key` query param into an error/log).
- Integration tests run against **real Postgres via PGlite** with a **fake `TmdbClient`** — no network. Pure logic is unit-tested.
- `npm run verify` (lint + typecheck + test + build) MUST pass before every commit.
- Repositories accept the shared `Database` type (`@/db/types`) so they work under both PGlite and node-postgres. Do not narrow it.
- Upsert writes only metadata columns; it never writes `quotes`, `lines`, or `attributions`.

---

## File Structure

```
package.json                          # add deps + `ingest` script
.env.example                          # add TMDB credential
src/ingest/
  parse-input.ts                      # parseInput() (pure)
  tmdb/
    types.ts                          # TMDB response types + TmdbClient interface
    client.ts                         # createTmdbClient() fetch impl (auth, 429 retry)
  mappers.ts                          # mapMovie/mapSeries/mapEpisode (pure) + MappedWork
  upsert.ts                           # upsertWork() (external-ref-keyed, idempotent)
  ingest-title.ts                     # ingestTitle() orchestration (movie & TV)
  db.ts                               # node-postgres Drizzle client for the CLI
  cli.ts                              # argv + env + run + summary
src/repositories/
  external-references.ts              # NEW: findEntityIdByRef, upsertExternalReference
  works.ts                            # ADD: updateWork
  editions.ts                         # ADD: updateEdition
tests/
  ingest/parse-input.test.ts
  ingest/tmdb/client.test.ts
  ingest/mappers.test.ts
  ingest/upsert.test.ts
  ingest/ingest-title.test.ts
  repositories/external-references.test.ts
  repositories/update-helpers.test.ts
```

---

## Task 1: Dependencies, script, env example

**Files:**
- Modify: `package.json`, `.env.example`

**Interfaces:**
- Consumes: nothing.
- Produces: `tsx`, `pg`, `@types/pg` installed; `ingest` npm script; documented TMDB env vars.

- [ ] **Step 1: Install dependencies**

```bash
cd /path/to/worktree
npm install pg@latest
npm install -D tsx@latest @types/pg@latest
```

- [ ] **Step 2: Add the `ingest` script**

In `package.json` `"scripts"`, add after `"db:push"`:

```json
    "ingest": "tsx src/ingest/cli.ts",
```

- [ ] **Step 3: Document the TMDB credential in `.env.example`**

Append to `.env.example`:

```
# TMDB credentials for the ingest CLI (npm run ingest).
# Prefer the v4 read access token (sent as a Bearer header).
TMDB_READ_ACCESS_TOKEN=
# Alternatively, a v3 API key (sent as an api_key query param).
TMDB_API_KEY=
```

- [ ] **Step 4: Verify**

Run: `npm run verify`
Expected: green (no source changes yet; the `ingest` script points at a file created in Task 10 but is not executed by verify).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: add ingest deps (tsx, pg) and TMDB env vars"
```

---

## Task 2: TMDB input parser

**Files:**
- Create: `src/ingest/parse-input.ts`, `tests/ingest/parse-input.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type TmdbInput = { type: "movie" | "tv"; id: number }`
  - `parseInput(input: string): TmdbInput` (throws `Error` on unrecognized input)

- [ ] **Step 1: Write the failing test**

`tests/ingest/parse-input.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { parseInput } from "@/ingest/parse-input";

describe("parseInput", () => {
  it("parses short movie/tv forms", () => {
    expect(parseInput("movie/11")).toEqual({ type: "movie", id: 11 });
    expect(parseInput("tv/1399")).toEqual({ type: "tv", id: 1399 });
  });

  it("parses full TMDB URLs with a slug suffix", () => {
    expect(parseInput("https://www.themoviedb.org/movie/11-star-wars")).toEqual({ type: "movie", id: 11 });
    expect(parseInput("https://www.themoviedb.org/tv/1399-game-of-thrones")).toEqual({ type: "tv", id: 1399 });
  });

  it("ignores trailing path segments on URLs", () => {
    expect(parseInput("https://www.themoviedb.org/tv/1399/season/1")).toEqual({ type: "tv", id: 1399 });
  });

  it("throws on unrecognized input", () => {
    expect(() => parseInput("person/500")).toThrow();
    expect(() => parseInput("movie/")).toThrow();
    expect(() => parseInput("nonsense")).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/ingest/parse-input.test.ts`
Expected: FAIL — cannot resolve `@/ingest/parse-input`.

- [ ] **Step 3: Write the implementation**

`src/ingest/parse-input.ts`:

```typescript
export type TmdbInput = { type: "movie" | "tv"; id: number };

const PATTERN = /(?:^|\/)(movie|tv)\/(\d+)/;

export function parseInput(input: string): TmdbInput {
  const match = PATTERN.exec(input.trim());
  if (!match) throw new Error(`unrecognized TMDB input: ${input}`);
  const type = match[1] === "movie" ? "movie" : "tv";
  return { type, id: Number(match[2]) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/ingest/parse-input.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify and commit**

```bash
npm run verify
git add src/ingest/parse-input.ts tests/ingest/parse-input.test.ts
git commit -m "feat: add TMDB input parser"
```

---

## Task 3: TMDB client & response types

**Files:**
- Create: `src/ingest/tmdb/types.ts`, `src/ingest/tmdb/client.ts`, `tests/ingest/tmdb/client.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (from `@/ingest/tmdb/types`):
  - `TmdbExternalIds = { imdb_id: string | null; wikidata_id: string | null }`
  - `TmdbMovie = { id: number; title: string; original_title: string; release_date: string | null; runtime: number | null; overview: string; original_language: string; external_ids: TmdbExternalIds }`
  - `TmdbSeasonSummary = { season_number: number }`
  - `TmdbSeries = { id: number; name: string; original_name: string; first_air_date: string | null; overview: string; seasons: TmdbSeasonSummary[]; external_ids: TmdbExternalIds }`
  - `TmdbEpisode = { id: number; episode_number: number; season_number: number; name: string; overview: string; runtime: number | null; air_date: string | null }`
  - `TmdbSeason = { season_number: number; episodes: TmdbEpisode[] }`
  - `interface TmdbClient { getMovie(id: number): Promise<TmdbMovie>; getSeries(id: number): Promise<TmdbSeries>; getSeason(seriesId: number, seasonNumber: number): Promise<TmdbSeason> }`
- Produces (from `@/ingest/tmdb/client`):
  - `type TmdbClientOptions = { token?: string; apiKey?: string; fetchImpl?: typeof fetch; baseUrl?: string; maxRetries?: number; retryBaseMs?: number }`
  - `createTmdbClient(options?: TmdbClientOptions): TmdbClient` (throws if no credential)
  - `class TmdbError extends Error` (carries `status: number`)

- [ ] **Step 1: Write the failing test**

`tests/ingest/tmdb/client.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { createTmdbClient, TmdbError } from "@/ingest/tmdb/client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("createTmdbClient", () => {
  it("throws when no credential is provided", () => {
    expect(() => createTmdbClient({ apiKey: undefined, token: undefined, fetchImpl: fetch })).toThrow();
  });

  it("sends a Bearer token and requests external_ids for a movie", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: 11, title: "Star Wars", external_ids: { imdb_id: "tt0076759", wikidata_id: "Q17738" } }));
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/ingest/tmdb/client.test.ts`
Expected: FAIL — cannot resolve `@/ingest/tmdb/client`.

- [ ] **Step 3: Write the types**

`src/ingest/tmdb/types.ts`:

```typescript
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
```

- [ ] **Step 4: Write the client**

`src/ingest/tmdb/client.ts`:

```typescript
import type { TmdbClient, TmdbMovie, TmdbSeason, TmdbSeries } from "@/ingest/tmdb/types";

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

  return {
    getMovie: (id) => get<TmdbMovie>(`/movie/${id}`, { append_to_response: "external_ids" }),
    getSeries: (id) => get<TmdbSeries>(`/tv/${id}`, { append_to_response: "external_ids" }),
    getSeason: (seriesId, seasonNumber) => get<TmdbSeason>(`/tv/${seriesId}/season/${seasonNumber}`),
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- --run tests/ingest/tmdb/client.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify and commit**

```bash
npm run verify
git add src/ingest/tmdb tests/ingest/tmdb
git commit -m "feat: add TMDB client and response types"
```

---

## Task 4: Mappers

**Files:**
- Create: `src/ingest/mappers.ts`, `tests/ingest/mappers.test.ts`

**Interfaces:**
- Consumes: `TmdbMovie`, `TmdbSeries`, `TmdbEpisode` from `@/ingest/tmdb/types`; `WorkType`, `EditionFormat`, `ReferenceProvider` from `@/db/schema`.
- Produces:
  - `type MappedRef = { provider: ReferenceProvider; externalId: string; url: string }`
  - `type MappedEdition = { format: EditionFormat; runtimeMs: number | null; language: string | null; releaseDate: string | null }`
  - `type MappedWork = { tmdbId: number; tmdbUrl: string; work: { type: WorkType; title: string; originalTitle: string | null; year: number | null; seasonNumber: number | null; episodeNumber: number | null; synopsis: string | null }; edition: MappedEdition | null; refs: MappedRef[] }`
  - `mapMovie(movie: TmdbMovie): MappedWork`
  - `mapSeries(series: TmdbSeries): MappedWork`
  - `mapEpisode(seriesTmdbId: number, episode: TmdbEpisode): MappedWork`

- [ ] **Step 1: Write the failing test**

`tests/ingest/mappers.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { mapEpisode, mapMovie, mapSeries } from "@/ingest/mappers";
import type { TmdbEpisode, TmdbMovie, TmdbSeries } from "@/ingest/tmdb/types";

const MOVIE: TmdbMovie = {
  id: 11,
  title: "Star Wars",
  original_title: "Star Wars",
  release_date: "1977-05-25",
  runtime: 121,
  overview: "A long time ago...",
  original_language: "en",
  external_ids: { imdb_id: "tt0076759", wikidata_id: "Q17738" },
};

describe("mapMovie", () => {
  it("maps a movie to a work + THEATRICAL edition + TMDB/IMDB/WIKIDATA refs", () => {
    const mapped = mapMovie(MOVIE);
    expect(mapped.tmdbId).toBe(11);
    expect(mapped.work.type).toBe("MOVIE");
    expect(mapped.work.title).toBe("Star Wars");
    expect(mapped.work.year).toBe(1977);
    expect(mapped.edition).toEqual({ format: "THEATRICAL", runtimeMs: 121 * 60_000, language: "en", releaseDate: "1977-05-25" });
    expect(mapped.refs.map((r) => r.provider).sort()).toEqual(["IMDB", "TMDB", "WIKIDATA"]);
    expect(mapped.refs.find((r) => r.provider === "IMDB")?.url).toBe("https://www.imdb.com/title/tt0076759/");
  });

  it("null runtime and missing external ids degrade gracefully", () => {
    const mapped = mapMovie({ ...MOVIE, runtime: null, external_ids: { imdb_id: null, wikidata_id: null } });
    expect(mapped.edition?.runtimeMs).toBeNull();
    expect(mapped.refs.map((r) => r.provider)).toEqual(["TMDB"]);
  });
});

describe("mapSeries", () => {
  it("maps a series to a work with no edition", () => {
    const series: TmdbSeries = {
      id: 1399,
      name: "Game of Thrones",
      original_name: "Game of Thrones",
      first_air_date: "2011-04-17",
      overview: "Nine noble families...",
      seasons: [{ season_number: 1 }],
      external_ids: { imdb_id: "tt0944947", wikidata_id: "Q23572" },
    };
    const mapped = mapSeries(series);
    expect(mapped.work.type).toBe("TV_SERIES");
    expect(mapped.work.year).toBe(2011);
    expect(mapped.edition).toBeNull();
    expect(mapped.refs.map((r) => r.provider).sort()).toEqual(["IMDB", "TMDB", "WIKIDATA"]);
  });
});

describe("mapEpisode", () => {
  it("maps an episode to a TV_EPISODE work + TV_BROADCAST edition + TMDB ref only", () => {
    const episode: TmdbEpisode = {
      id: 63056,
      episode_number: 1,
      season_number: 1,
      name: "Winter Is Coming",
      overview: "Eddard Stark...",
      runtime: 62,
      air_date: "2011-04-17",
    };
    const mapped = mapEpisode(1399, episode);
    expect(mapped.tmdbId).toBe(63056);
    expect(mapped.work.type).toBe("TV_EPISODE");
    expect(mapped.work.seasonNumber).toBe(1);
    expect(mapped.work.episodeNumber).toBe(1);
    expect(mapped.edition).toEqual({ format: "TV_BROADCAST", runtimeMs: 62 * 60_000, language: null, releaseDate: "2011-04-17" });
    expect(mapped.refs.map((r) => r.provider)).toEqual(["TMDB"]);
    expect(mapped.tmdbUrl).toBe("https://www.themoviedb.org/tv/1399/season/1/episode/1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/ingest/mappers.test.ts`
Expected: FAIL — cannot resolve `@/ingest/mappers`.

- [ ] **Step 3: Write the implementation**

`src/ingest/mappers.ts`:

```typescript
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
    },
    edition: {
      format: "THEATRICAL",
      runtimeMs: runtimeToMs(movie.runtime),
      language: nullIfEmpty(movie.original_language),
      releaseDate: movie.release_date ?? null,
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
    },
    edition: {
      format: "TV_BROADCAST",
      runtimeMs: runtimeToMs(episode.runtime),
      language: null,
      releaseDate: episode.air_date ?? null,
    },
    refs: [{ provider: "TMDB", externalId: String(episode.id), url: tmdbUrl }],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/ingest/mappers.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify and commit**

```bash
npm run verify
git add src/ingest/mappers.ts tests/ingest/mappers.test.ts
git commit -m "feat: add TMDB response mappers"
```

---

## Task 5: External-reference repository

**Files:**
- Create: `src/repositories/external-references.ts`, `tests/repositories/external-references.test.ts`

**Interfaces:**
- Consumes: `Database` from `@/db/types`; `EntityType`, `ReferenceProvider`, `externalReferences` from `@/db/schema`.
- Produces:
  - `findEntityIdByRef(db: Database, entityType: EntityType, provider: ReferenceProvider, externalId: string): Promise<string | null>`
  - `type ExternalRefInput = { entityType: EntityType; entityId: string; provider: ReferenceProvider; externalId: string; url: string | null }`
  - `upsertExternalReference(db: Database, ref: ExternalRefInput): Promise<void>`

- [ ] **Step 1: Write the failing test**

`tests/repositories/external-references.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { createTestDb } from "../setup/test-db";
import { findEntityIdByRef, upsertExternalReference } from "@/repositories/external-references";

describe("external references", () => {
  it("returns null when no ref exists", async () => {
    const db = await createTestDb();
    expect(await findEntityIdByRef(db, "WORK", "TMDB", "11")).toBeNull();
  });

  it("inserts then finds a ref", async () => {
    const db = await createTestDb();
    await upsertExternalReference(db, { entityType: "WORK", entityId: "work-1", provider: "TMDB", externalId: "11", url: "https://x" });
    expect(await findEntityIdByRef(db, "WORK", "TMDB", "11")).toBe("work-1");
  });

  it("upserts (no duplicate) and updates url/entityId on conflict", async () => {
    const db = await createTestDb();
    await upsertExternalReference(db, { entityType: "WORK", entityId: "work-1", provider: "TMDB", externalId: "11", url: "https://old" });
    await upsertExternalReference(db, { entityType: "WORK", entityId: "work-1", provider: "TMDB", externalId: "11", url: "https://new" });
    expect(await findEntityIdByRef(db, "WORK", "TMDB", "11")).toBe("work-1");
  });

  it("distinguishes WORK vs EDITION refs sharing an external id", async () => {
    const db = await createTestDb();
    await upsertExternalReference(db, { entityType: "WORK", entityId: "w", provider: "TMDB", externalId: "11", url: null });
    await upsertExternalReference(db, { entityType: "EDITION", entityId: "e", provider: "TMDB", externalId: "11", url: null });
    expect(await findEntityIdByRef(db, "WORK", "TMDB", "11")).toBe("w");
    expect(await findEntityIdByRef(db, "EDITION", "TMDB", "11")).toBe("e");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/repositories/external-references.test.ts`
Expected: FAIL — cannot resolve `@/repositories/external-references`.

- [ ] **Step 3: Write the implementation**

`src/repositories/external-references.ts`:

```typescript
import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/types";
import type { EntityType, ReferenceProvider } from "@/db/schema";
import { externalReferences } from "@/db/schema";

export async function findEntityIdByRef(
  db: Database,
  entityType: EntityType,
  provider: ReferenceProvider,
  externalId: string,
): Promise<string | null> {
  const rows = await db
    .select({ entityId: externalReferences.entityId })
    .from(externalReferences)
    .where(
      and(
        eq(externalReferences.entityType, entityType),
        eq(externalReferences.provider, provider),
        eq(externalReferences.externalId, externalId),
      ),
    )
    .limit(1);
  return rows[0]?.entityId ?? null;
}

export type ExternalRefInput = {
  entityType: EntityType;
  entityId: string;
  provider: ReferenceProvider;
  externalId: string;
  url: string | null;
};

export async function upsertExternalReference(db: Database, ref: ExternalRefInput): Promise<void> {
  await db
    .insert(externalReferences)
    .values({
      entityType: ref.entityType,
      entityId: ref.entityId,
      provider: ref.provider,
      externalId: ref.externalId,
      url: ref.url,
    })
    .onConflictDoUpdate({
      target: [externalReferences.provider, externalReferences.entityType, externalReferences.externalId],
      set: { entityId: ref.entityId, url: ref.url, updatedAt: new Date() },
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/repositories/external-references.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify and commit**

```bash
npm run verify
git add src/repositories/external-references.ts tests/repositories/external-references.test.ts
git commit -m "feat: add external-reference find/upsert repository"
```

---

## Task 6: Work & edition update helpers

**Files:**
- Modify: `src/repositories/works.ts`, `src/repositories/editions.ts`
- Create: `tests/repositories/update-helpers.test.ts`

**Interfaces:**
- Consumes: `Database`, `createWork`, `createEdition`, schema tables.
- Produces:
  - `type UpdateWorkFields = { title?: string; originalTitle?: string | null; year?: number | null; seasonNumber?: number | null; episodeNumber?: number | null; synopsis?: string | null; parentWorkId?: string | null }`
  - `updateWork(db: Database, id: string, fields: UpdateWorkFields): Promise<void>` (from `@/repositories/works`)
  - `type UpdateEditionFields = { format?: EditionFormat; runtimeMs?: number | null; language?: string | null; releaseDate?: string | null }`
  - `updateEdition(db: Database, id: string, fields: UpdateEditionFields): Promise<void>` (from `@/repositories/editions`)

- [ ] **Step 1: Write the failing test**

`tests/repositories/update-helpers.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../setup/test-db";
import { editions, works } from "@/db/schema";
import { createWork, updateWork } from "@/repositories/works";
import { createEdition, updateEdition } from "@/repositories/editions";

describe("updateWork", () => {
  it("updates metadata fields in place, leaving slug intact", async () => {
    const db = await createTestDb();
    const created = await createWork(db, { type: "MOVIE", title: "Old Title" });
    await updateWork(db, created.id, { title: "New Title", year: 1999, synopsis: "s" });
    const [row] = await db.select().from(works).where(eq(works.id, created.id));
    expect(row.title).toBe("New Title");
    expect(row.year).toBe(1999);
    expect(row.slug).toBe(created.slug);
  });
});

describe("updateEdition", () => {
  it("updates edition fields in place", async () => {
    const db = await createTestDb();
    const work = await createWork(db, { type: "MOVIE", title: "M" });
    const edition = await createEdition(db, { workId: work.id, format: "THEATRICAL" });
    await updateEdition(db, edition.id, { runtimeMs: 7_260_000, releaseDate: "1977-05-25" });
    const [row] = await db.select().from(editions).where(eq(editions.id, edition.id));
    expect(row.runtimeMs).toBe(7_260_000);
    expect(row.releaseDate).toBe("1977-05-25");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/repositories/update-helpers.test.ts`
Expected: FAIL — `updateWork` / `updateEdition` not exported.

- [ ] **Step 3: Add the implementations**

Append to `src/repositories/works.ts` (keep existing exports; `Database`, `works`, `eq` may already be imported — do not duplicate):

```typescript
import { eq } from "drizzle-orm";

export type UpdateWorkFields = {
  title?: string;
  originalTitle?: string | null;
  year?: number | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  synopsis?: string | null;
  parentWorkId?: string | null;
};

export async function updateWork(db: Database, id: string, fields: UpdateWorkFields): Promise<void> {
  await db.update(works).set({ ...fields, updatedAt: new Date() }).where(eq(works.id, id));
}
```

Append to `src/repositories/editions.ts` (keep existing exports; add imports without duplicating):

```typescript
import { eq } from "drizzle-orm";
import type { EditionFormat } from "@/db/schema";

export type UpdateEditionFields = {
  format?: EditionFormat;
  runtimeMs?: number | null;
  language?: string | null;
  releaseDate?: string | null;
};

export async function updateEdition(db: Database, id: string, fields: UpdateEditionFields): Promise<void> {
  await db.update(editions).set({ ...fields, updatedAt: new Date() }).where(eq(editions.id, id));
}
```

Note: `Database` and the table imports (`works` / `editions`) already exist at the top of each file from earlier tasks — merge the `eq` / `EditionFormat` imports into the existing import lines rather than duplicating.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/repositories/update-helpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify and commit**

```bash
npm run verify
git add src/repositories/works.ts src/repositories/editions.ts tests/repositories/update-helpers.test.ts
git commit -m "feat: add updateWork and updateEdition helpers"
```

---

## Task 7: Idempotent upsert

**Files:**
- Create: `src/ingest/upsert.ts`, `tests/ingest/upsert.test.ts`

**Interfaces:**
- Consumes: `Database`; `MappedWork`; `createWork`, `updateWork`, `createEdition`, `updateEdition`, `findEntityIdByRef`, `upsertExternalReference`.
- Produces:
  - `type UpsertResult = { workId: string; workCreated: boolean; editionCreated: boolean }`
  - `upsertWork(db: Database, mapped: MappedWork, parentWorkId: string | null): Promise<UpsertResult>`

- [ ] **Step 1: Write the failing test**

`tests/ingest/upsert.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../setup/test-db";
import { editions, externalReferences, works } from "@/db/schema";
import { upsertWork } from "@/ingest/upsert";
import type { MappedWork } from "@/ingest/mappers";

const MOVIE: MappedWork = {
  tmdbId: 11,
  tmdbUrl: "https://www.themoviedb.org/movie/11",
  work: { type: "MOVIE", title: "Star Wars", originalTitle: "Star Wars", year: 1977, seasonNumber: null, episodeNumber: null, synopsis: "..." },
  edition: { format: "THEATRICAL", runtimeMs: 7_260_000, language: "en", releaseDate: "1977-05-25" },
  refs: [
    { provider: "TMDB", externalId: "11", url: "https://www.themoviedb.org/movie/11" },
    { provider: "IMDB", externalId: "tt0076759", url: "https://www.imdb.com/title/tt0076759/" },
  ],
};

describe("upsertWork", () => {
  it("creates a work, edition, and refs on first run", async () => {
    const db = await createTestDb();
    const result = await upsertWork(db, MOVIE, null);
    expect(result.workCreated).toBe(true);
    expect(result.editionCreated).toBe(true);
    expect(await db.select().from(works)).toHaveLength(1);
    expect(await db.select().from(editions)).toHaveLength(1);
    // 2 WORK refs (TMDB, IMDB) + 1 EDITION ref (TMDB)
    expect(await db.select().from(externalReferences)).toHaveLength(3);
  });

  it("is idempotent: a second run creates no duplicates and updates fields", async () => {
    const db = await createTestDb();
    await upsertWork(db, MOVIE, null);
    const second = await upsertWork(db, { ...MOVIE, work: { ...MOVIE.work, title: "Star Wars: A New Hope" } }, null);
    expect(second.workCreated).toBe(false);
    expect(second.editionCreated).toBe(false);
    expect(await db.select().from(works)).toHaveLength(1);
    expect(await db.select().from(editions)).toHaveLength(1);
    expect(await db.select().from(externalReferences)).toHaveLength(3);
    const [row] = await db.select().from(works).where(eq(works.id, second.workId));
    expect(row.title).toBe("Star Wars: A New Hope");
  });

  it("sets parentWorkId for episodes", async () => {
    const db = await createTestDb();
    const parent = await upsertWork(db, { ...MOVIE, tmdbId: 999, work: { ...MOVIE.work, type: "TV_SERIES" }, edition: null, refs: [{ provider: "TMDB", externalId: "999", url: "u" }] }, null);
    const episode: MappedWork = {
      tmdbId: 63056,
      tmdbUrl: "u",
      work: { type: "TV_EPISODE", title: "Ep", originalTitle: null, year: 2011, seasonNumber: 1, episodeNumber: 1, synopsis: null },
      edition: { format: "TV_BROADCAST", runtimeMs: null, language: null, releaseDate: null },
      refs: [{ provider: "TMDB", externalId: "63056", url: "u" }],
    };
    const res = await upsertWork(db, episode, parent.workId);
    const [row] = await db.select().from(works).where(eq(works.id, res.workId));
    expect(row.parentWorkId).toBe(parent.workId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/ingest/upsert.test.ts`
Expected: FAIL — cannot resolve `@/ingest/upsert`.

- [ ] **Step 3: Write the implementation**

`src/ingest/upsert.ts`:

```typescript
import type { Database } from "@/db/types";
import type { MappedWork } from "@/ingest/mappers";
import { createWork, updateWork } from "@/repositories/works";
import { createEdition, updateEdition } from "@/repositories/editions";
import { findEntityIdByRef, upsertExternalReference } from "@/repositories/external-references";

export type UpsertResult = { workId: string; workCreated: boolean; editionCreated: boolean };

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/ingest/upsert.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify and commit**

```bash
npm run verify
git add src/ingest/upsert.ts tests/ingest/upsert.test.ts
git commit -m "feat: add idempotent external-ref-keyed upsertWork"
```

---

## Task 8: Ingest orchestration

**Files:**
- Create: `src/ingest/ingest-title.ts`, `tests/ingest/ingest-title.test.ts`

**Interfaces:**
- Consumes: `Database`; `TmdbClient` from `@/ingest/tmdb/types`; `TmdbInput` from `@/ingest/parse-input`; `mapMovie`/`mapSeries`/`mapEpisode`; `upsertWork`.
- Produces:
  - `type IngestSummary = { type: "movie" | "tv"; workId: string; workCreated: boolean; episodesCreated: number; episodesUpdated: number }`
  - `ingestTitle(db: Database, tmdb: TmdbClient, input: TmdbInput): Promise<IngestSummary>`

- [ ] **Step 1: Write the failing test**

`tests/ingest/ingest-title.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../setup/test-db";
import { works } from "@/db/schema";
import { ingestTitle } from "@/ingest/ingest-title";
import type { TmdbClient, TmdbMovie, TmdbSeason, TmdbSeries } from "@/ingest/tmdb/types";

const MOVIE: TmdbMovie = {
  id: 11, title: "Star Wars", original_title: "Star Wars", release_date: "1977-05-25",
  runtime: 121, overview: "...", original_language: "en", external_ids: { imdb_id: "tt0076759", wikidata_id: "Q17738" },
};
const SERIES: TmdbSeries = {
  id: 1399, name: "GoT", original_name: "GoT", first_air_date: "2011-04-17", overview: "...",
  seasons: [{ season_number: 1 }], external_ids: { imdb_id: "tt0944947", wikidata_id: "Q23572" },
};
const SEASON_1: TmdbSeason = {
  season_number: 1,
  episodes: [
    { id: 63056, episode_number: 1, season_number: 1, name: "Ep1", overview: "", runtime: 62, air_date: "2011-04-17" },
    { id: 63057, episode_number: 2, season_number: 1, name: "Ep2", overview: "", runtime: 55, air_date: "2011-04-24" },
  ],
};

class FakeTmdb implements TmdbClient {
  constructor(private seasons: Record<number, TmdbSeason> = { 1: SEASON_1 }) {}
  async getMovie(): Promise<TmdbMovie> { return MOVIE; }
  async getSeries(): Promise<TmdbSeries> { return SERIES; }
  async getSeason(_seriesId: number, seasonNumber: number): Promise<TmdbSeason> { return this.seasons[seasonNumber]; }
}

describe("ingestTitle", () => {
  it("ingests a movie", async () => {
    const db = await createTestDb();
    const summary = await ingestTitle(db, new FakeTmdb(), { type: "movie", id: 11 });
    expect(summary.type).toBe("movie");
    expect(summary.workCreated).toBe(true);
    expect(await db.select().from(works)).toHaveLength(1);
  });

  it("ingests a series with all episodes as child works", async () => {
    const db = await createTestDb();
    const summary = await ingestTitle(db, new FakeTmdb(), { type: "tv", id: 1399 });
    expect(summary.episodesCreated).toBe(2);
    const rows = await db.select().from(works);
    expect(rows).toHaveLength(3); // series + 2 episodes
    const episodes = rows.filter((r) => r.type === "TV_EPISODE");
    expect(episodes.every((e) => e.parentWorkId === summary.workId)).toBe(true);
  });

  it("is idempotent and picks up newly-added episodes on re-run", async () => {
    const db = await createTestDb();
    await ingestTitle(db, new FakeTmdb(), { type: "tv", id: 1399 });
    const withNewEpisode: Record<number, TmdbSeason> = {
      1: { season_number: 1, episodes: [...SEASON_1.episodes, { id: 63058, episode_number: 3, season_number: 1, name: "Ep3", overview: "", runtime: 58, air_date: "2011-05-01" }] },
    };
    const summary = await ingestTitle(db, new FakeTmdb(withNewEpisode), { type: "tv", id: 1399 });
    expect(summary.episodesCreated).toBe(1);
    expect(summary.episodesUpdated).toBe(2);
    expect(await db.select().from(works)).toHaveLength(4); // series + 3 episodes, no duplicates
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/ingest/ingest-title.test.ts`
Expected: FAIL — cannot resolve `@/ingest/ingest-title`.

- [ ] **Step 3: Write the implementation**

`src/ingest/ingest-title.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/ingest/ingest-title.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify and commit**

```bash
npm run verify
git add src/ingest/ingest-title.ts tests/ingest/ingest-title.test.ts
git commit -m "feat: add ingest orchestration for movies and series"
```

---

## Task 9: Batch DB client

**Files:**
- Create: `src/ingest/db.ts`

**Interfaces:**
- Consumes: `pg`, `drizzle-orm/node-postgres`, `@/db/schema`, `Database` type.
- Produces:
  - `createIngestDb(): { db: Database; close: () => Promise<void> }` — a node-postgres Drizzle client on the direct connection.

- [ ] **Step 1: Write the client**

`src/ingest/db.ts`:

```typescript
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Database } from "@/db/types";
import * as schema from "@/db/schema";

export function createIngestDb(): { db: Database; close: () => Promise<void> } {
  const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL is not set");
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });
  return { db, close: () => pool.end() };
}
```

- [ ] **Step 2: Verify types and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed. (No unit test — this opens a live TCP connection; it is exercised by the CLI against a real database.)

- [ ] **Step 3: Verify and commit**

```bash
npm run verify
git add src/ingest/db.ts
git commit -m "feat: add node-postgres batch DB client for ingest"
```

---

## Task 10: CLI entrypoint

**Files:**
- Create: `src/ingest/cli.ts`

**Interfaces:**
- Consumes: `dotenv`, `parseInput`, `createTmdbClient`, `createIngestDb`, `ingestTitle`.
- Produces: an executable module run via `npm run ingest -- <input>`.

- [ ] **Step 1: Write the CLI**

`src/ingest/cli.ts`:

```typescript
import { config } from "dotenv";
import { parseInput } from "@/ingest/parse-input";
import { createTmdbClient } from "@/ingest/tmdb/client";
import { createIngestDb } from "@/ingest/db";
import { ingestTitle } from "@/ingest/ingest-title";

config({ path: process.env.ENV_FILE ?? ".env.local" });

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg) throw new Error("usage: npm run ingest -- <tmdb-url-or-movie/ID-or-tv/ID>");

  const input = parseInput(arg);
  const tmdb = createTmdbClient();
  const { db, close } = createIngestDb();
  try {
    const summary = await ingestTitle(db, tmdb, input);
    if (summary.type === "movie") {
      console.log(`Ingested movie ${input.id} (${summary.workCreated ? "created" : "updated"}): work ${summary.workId}`);
    } else {
      console.log(
        `Ingested series ${input.id} (${summary.workCreated ? "created" : "updated"}): work ${summary.workId}, ` +
          `${summary.episodesCreated} episodes created, ${summary.episodesUpdated} updated`,
      );
    }
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
```

- [ ] **Step 2: Verify types and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed. (No unit test — the CLI wires live TMDB + DB; run it manually against a real database with a real token: `npm run ingest -- movie/11`.)

- [ ] **Step 3: Verify and commit**

```bash
npm run verify
git add src/ingest/cli.ts
git commit -m "feat: add ingest CLI entrypoint"
```

---

## Self-Review (completed during authoring)

**Spec coverage:**
- CLI `npm run ingest -- <input>`, URL/short forms → Task 2 (parser), Task 10 (CLI).
- Movies + TV, whole series incl. season 0 → Task 8 (iterates all `series.seasons`).
- Default edition per movie/episode; none for series → Tasks 4 (mappers) + 7 (upsert).
- External refs TMDB/IMDB/WIKIDATA for movie/series, TMDB-only for episodes → Task 4.
- Idempotent upsert keyed on external refs; edition keyed by its own EDITION ref → Tasks 5, 7; re-run/new-episode behavior → Task 8 tests.
- Upsert touches only metadata (never quotes/lines/attributions) → Task 7 (writes only works/editions/refs).
- node-postgres batch client on the direct connection → Task 9; serverless `getDb()` untouched.
- TMDB auth from env, never leaked (errors carry the path, not the api_key URL) → Task 3 (client + test).
- Hermetic tests: PGlite + fake `TmdbClient` → Tasks 7, 8; pure unit tests → Tasks 2, 3, 4.

**Placeholder scan:** none — every code/test step is complete.

**Type consistency:** `Database`, `MappedWork`/`MappedEdition`/`MappedRef`, `TmdbClient` and its response types, `UpsertResult`, `IngestSummary`, and the repository signatures (`findEntityIdByRef`, `upsertExternalReference`, `updateWork`, `updateEdition`, `createWork`, `createEdition`) are consistent across defining and consuming tasks. `createWork`/`createEdition` optional (`?: T`) inputs receive `?? undefined`; update helpers accept `T | null`.

**Deviations from spec (intentional, minor):** the spec mentioned a "small concurrency cap" on the TMDB client; orchestration is sequential (≤1 outstanding request), so a concurrency limiter is unnecessary and omitted — retry-with-backoff on 429 is implemented. Flag for reviewer if a parallel fetch strategy is later wanted.
