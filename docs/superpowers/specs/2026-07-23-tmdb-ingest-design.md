# iqdb — TMDB Metadata Ingest (Pass A) Design

**Date:** 2026-07-23
**Status:** Approved (design); implementation plan pending
**Author:** Chad Walker (with Claude)
**Builds on:** `docs/superpowers/specs/2026-07-23-quote-database-design.md` (data layer, merged)

## Summary

A CLI that pulls a movie or a full TV series from TMDB into the existing
`works`, `editions`, and `external_references` tables — idempotently, so
re-running refreshes metadata and picks up newly-aired episodes without
duplicating. This is the automatable half of ingest ("Pass A"). It does not
create characters, books, or quotes.

## Goals

- Populate canonical `works` (and their default `editions` + external links)
  that quotes will later reference, from a single TMDB input.
- Make later quote authoring easy: after ingesting a series, every episode is
  already present and immediately quotable (has a default edition).
- Idempotent: re-run = upsert. Never duplicate; never touch content a later
  authoring pass attaches.

## Non-goals (deferred)

- **Characters / cast.** Fetched live from TMDB during the later quote-authoring
  pass, where canonical-character identity is a human decision. TMDB has no
  stable cross-title character id, so batch dedup is not attempted here.
- **Character-dedup tool.** A future tool (pairs with People/appearances).
- **Books.** Separate later pipeline against a book provider (Open Library /
  Google Books).
- **Quote authoring / import.** Pass B.
- **People / appearances.** As in the data-layer spec.
- **Any job infrastructure** (queues, schedulers). CLI, run manually per title.

## Scope decisions (resolved during brainstorming)

- Media: movies + TV via TMDB only.
- TV depth: whole series in one shot — series `work` + all seasons + all
  episodes (including season 0 / specials).
- Interface: CLI, `npm run ingest -- <input>`.
- Re-run behavior: upsert (refresh metadata, add new episodes).
- Characters: not ingested.
- Editions: one default edition auto-created per quotable work.
- External references: TMDB + IMDB + WIKIDATA for movies and series; TMDB only
  for episodes (avoids per-episode API fan-out).

## Stack additions

- **TMDB access** via `fetch` (no SDK). Auth read from env: prefer a v4 read
  access token (`TMDB_READ_ACCESS_TOKEN`, sent as `Authorization: Bearer`),
  fall back to a v3 key (`TMDB_API_KEY`, sent as an `api_key` query param). The
  token is never logged or printed. Documented in `.env.example`.
- **CLI runner**: `tsx` (dev dependency); script `ingest` in `package.json`.
- **Batch DB client**: a dedicated Drizzle **node-postgres** (`pg`) client over
  the **direct/unpooled** connection (`DATABASE_URL_UNPOOLED ?? DATABASE_URL`).
  A long-running batch job with many transactions is the wrong fit for the
  serverless websocket driver `getDb()` uses. Repositories are driver-agnostic
  (they accept the shared `Database` type, a `PgDatabase` supertype), so they
  work unchanged against this client. New dev/runtime deps: `tsx`, `pg`,
  `@types/pg`.

## Module structure

```
src/ingest/
  parse-input.ts        # "movie/11" | "tv/1399" | TMDB URL -> { type, id }  (pure)
  tmdb/
    client.ts           # TmdbClient interface + fetch implementation
    types.ts            # typed subset of TMDB responses (no `any`)
  mappers.ts            # TMDB response -> work/edition/external-ref inputs   (pure)
  ingest-title.ts       # orchestration: fetch -> map -> upsert (movie & TV)
  db.ts                 # node-postgres Drizzle client for the CLI
  cli.ts                # argv parse + env load + run + summary
src/repositories/
  external-references.ts # NEW: findWorkIdByExternalRef, upsertExternalReference
  works.ts               # ADD: updateWork + upsertWorkByTmdbId
  editions.ts            # ADD: upsertDefaultEdition (external-ref keyed)
```

The `TmdbClient` is an **interface**; `ingest-title.ts` depends on the
interface, `cli.ts` wires the real fetch implementation, and tests inject a
fake. This is what keeps orchestration tests hermetic.

## TMDB endpoints used

- Movie: `GET /movie/{id}` (+ `append_to_response=external_ids`) → title,
  original_title, release_date, runtime, overview, original_language,
  `external_ids.imdb_id`, `external_ids.wikidata_id`.
- TV series: `GET /tv/{id}` (+ `append_to_response=external_ids`) → name,
  original_name, first_air_date, overview, `seasons[]` (season_number),
  external ids.
- TV season: `GET /tv/{id}/season/{season_number}` → `episodes[]` with
  episode_number, name, overview, runtime, air_date, id.

Episodes use the season payload; no per-episode requests (so no episode-level
external ids).

## Mapping rules

Runtime minutes → `runtimeMs` (`minutes * 60_000`); missing/zero → null. Year
parsed from the release/first-air date (null if absent). `language` from
`original_language` (movies only).

- **Movie** → `work{ type: MOVIE, title, originalTitle, year, synopsis }`
  + `edition{ format: THEATRICAL, runtimeMs, language, releaseDate }`
  + refs: TMDB, IMDB (if present), WIKIDATA (if present).
- **TV series** → `work{ type: TV_SERIES, title, originalTitle, year, synopsis }`,
  **no edition**, + refs: TMDB, IMDB (if present), WIKIDATA (if present).
- **TV episode** → `work{ type: TV_EPISODE, parentWorkId: <series>, seasonNumber,
  episodeNumber, title, synopsis }`
  + `edition{ format: TV_BROADCAST, runtimeMs, releaseDate }`
  + ref: TMDB only.

Seasons are represented only by `episode.seasonNumber` — there is no season
`work` (the schema has no SEASON type).

## Idempotency (external-ref-keyed upsert)

- **Find a work**: query `external_references` where
  `(provider = TMDB, entityType = WORK, externalId = <tmdb id>)`; the row's
  `entityId` is the work id. The unique index
  `(provider, entityType, externalId)` guarantees at most one.
- **Upsert a work**: found → `updateWork(db, id, fields)` on metadata columns
  only; not found → `createWork` then insert the TMDB WORK ref.
- **Upsert the default edition**: the ingest-created edition carries its own
  `external_references(provider = TMDB, entityType = EDITION,
  externalId = <tmdb id>)`. Re-runs find that edition via the ref and update it
  in place; editions added by hand have no such ref and are never touched.
- **External refs**: upsert on `(provider, entityType, externalId)` — insert if
  absent, update `url`/`entityId` if present.
- Upsert writes **only metadata columns**. It never writes or deletes
  `quotes`, `lines`, or `attributions`.

## Orchestration & resilience

- **Movie**: fetch details+external_ids → upsert work + default edition + refs
  in a single transaction. Print a one-line summary.
- **TV**: upsert the series work + refs first (own transaction). Then for each
  season, fetch season details and upsert each **episode + its edition + ref in
  its own transaction**. A failure partway through a long series is therefore
  resumable — re-running skips/updates completed episodes (upsert) and
  continues. Print a summary (series + counts of episodes created/updated).
- **TMDB client**: a small concurrency cap on outstanding requests and
  retry-with-exponential-backoff on HTTP 429; typed errors on other non-2xx.

## CLI

- `npm run ingest -- <input>` where `<input>` is a TMDB URL
  (`https://www.themoviedb.org/movie/11-star-wars`,
  `https://www.themoviedb.org/tv/1399`) or a short `movie/11` / `tv/1399`.
- Loads env from `ENV_FILE ?? .env.local` (same convention as drizzle config),
  so it can target a specific database.
- Exits non-zero with a clear message on a bad input, a missing TMDB token, or
  a TMDB/DB error.

## Testing

- **Unit** (pure, over fixture JSON): `parse-input` (URL and short forms, bad
  input); `mappers` (movie / series / episode field mapping, runtime and year
  edge cases, missing external ids).
- **Integration** (PGlite + a **fake `TmdbClient`** returning fixtures — no
  network):
  - First run creates the expected work/edition/ref graph (movie; and a small
    series with 2 seasons → series + episodes).
  - **Second run creates zero duplicate rows** and updates changed metadata.
  - A season/episode added to the fixture appears on re-run; existing rows are
    untouched beyond metadata.
  - Upsert never creates a second edition for an already-ingested work.
- No live-network test in CI. An optional manual smoke path may hit the real API
  when a real token is present; it is not part of `npm run verify`.

## Open items for the implementation plan

- Exact `TmdbClient` interface shape and the fixture set.
- Concurrency-cap / backoff parameter values.
- Whether `updateWork` and the upsert helpers live in the existing repository
  files or a dedicated `src/repositories/upsert.ts` (leaning: extend the
  existing per-entity files, add `external-references.ts`).
