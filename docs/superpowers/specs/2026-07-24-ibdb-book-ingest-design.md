# IBDB Book Ingest Design

**Date:** 2026-07-24
**Status:** Approved

## Goal

Add a book ingest path that pulls book metadata from IBDB (Internet Book
Database, `ibdb.dev`, no auth) and writes it into the quote data layer as
`works` (type `BOOK`) + `editions`, mirroring the existing TMDB movie/TV ingest.
This lets books be searched, browsed, and have quotes attached to their editions.

## Source API

Public JSON, no token:

- `GET https://ibdb.dev/isbn/{isbn13}.json` → `{ status, book }`
- `GET https://ibdb.dev/book/{ibdbId}.json` → `{ status, book }`

Both return the parent book (with all its editions). `ApiBook` fields used:
`id`, `title`, `synopsis`, `publicationDate` (e.g. `"2024-08-27"`),
`image.url` (a full `https://images.isbndb.com/…` URL), `authors[].name`,
`editions[]` (each `{ isbn13, binding, publicationDate, image }`).
(The `/api/isbn-json/…` and `/api/book-json/…` paths in the old API doc still
work but are rewritten to these; we target the canonical `.json` URLs.)

## CLI input

Extend `parseInput` to recognize, alongside `movie/ID` and `tv/ID`:

- `isbn/{isbn13}` and `ibdb.dev/isbn/{isbn13}` (with or without `.json`)
- `book/{ibdbId}` and `ibdb.dev/book/{ibdbId}`

`parseInput` returns a discriminated union:
`{ source: "tmdb", type, id }` | `{ source: "ibdb", kind: "isbn" | "book", value }`.
The CLI dispatches TMDB → existing `ingestTitle`; IBDB → new `ingestBook`.

## Schema change

One additive, nullable column (migration via `db:generate`):

```
works.byline text   -- e.g. "Matt Dinniman"; authors joined, denormalized
```

No author table, no ISBN column (YAGNI — see Out of scope).

## Mapping (`ApiBook` → work + editions + refs)

- **work**: `type: "BOOK"`, `title`, `synopsis` (null if empty), `year`
  (parsed from `publicationDate`), `byline` (authors' names joined with `, `;
  null if none), `posterPath` = `book.image.url` (full URL).
- **editions**: one per `ApiEdition`. `binding` → `editionFormat`:
  `Hardcover→HARDCOVER`, `Paperback→PAPERBACK`, `Ebook→EBOOK`,
  `Audiobook→AUDIOBOOK`, `Unknown→OTHER`. `releaseDate` from the edition's
  `publicationDate` (null if empty).
- **external references** (idempotency keys; reuse the existing `IBDB` provider
  already in the `reference_provider` enum):
  - work → `(entityType WORK, provider IBDB, externalId book.id, url .../book/{id})`
  - each edition → `(entityType EDITION, provider IBDB, externalId isbn13,
    url .../isbn/{isbn13})`

Re-ingesting the same book updates rather than duplicates (via
`findEntityIdByRef` on the IBDB refs), matching the TMDB `upsertWork` pattern.
The edition's ISBN is captured on its external reference.

## Covers (generalized poster)

Book covers are full `images.isbndb.com` URLs, but `posterPath` was previously a
TMDB path that `WorkPoster` turns into `https://image.tmdb.org/t/p/w342{path}`.
Generalize the poster-URL helper: if `posterPath` starts with `http`, return it
unchanged; otherwise build the TMDB URL. Add `images.isbndb.com` to
`next.config` `images.remotePatterns`. One `posterPath` field then serves both
sources with no per-work branching in the UI.

## Components / files

- `src/ingest/ibdb/types.ts` — `IbdbBook`, `IbdbEdition`, `IbdbAuthor`,
  `IbdbImage`, `IbdbBookResponse`.
- `src/ingest/ibdb/client.ts` — `createIbdbClient()` with
  `getBookByIsbn(isbn13)` / `getBookById(id)`; fetch with retry, same shape as
  the TMDB client.
- `src/ingest/ibdb/map-book.ts` — `mapBook(book): MappedBook` (work fields +
  `editions[]` + refs).
- `src/ingest/ingest-book.ts` — `ingestBook(db, ibdb, input)`: fetch → map →
  upsert work (by IBDB ref) → upsert each edition (by IBDB/isbn13 ref) → upsert
  refs; returns a summary.
- `src/ingest/parse-input.ts` — extend to the discriminated union above.
- `src/ingest/cli.ts` — dispatch by `source`.
- `src/lib/tmdb-image.ts` (or generalized) — pass-through for full URLs.
- `app/_components/WorkPoster.tsx`, `next.config.ts` — use the generalized
  helper; allow `images.isbndb.com`.

## Out of scope (YAGNI)

Author table / author pages / dedup; a dedicated ISBN column; search/bulk
ingest; GoodReads / OpenLibrary / Hardcover external refs (no enum providers).

## Testing

- `ibdb/client` with a mocked `fetch` (success, error status, retry).
- `mapBook` fixture → mapped work/editions/refs, binding mapping, empty-string
  handling, byline join, cover URL.
- `ingestBook` on pglite with a mock client: creates work + multiple editions,
  stores byline + cover + refs, and is idempotent on re-ingest.
- `parseInput` for `isbn/…`, `book/…`, and `ibdb.dev/…` URL forms plus the
  existing TMDB forms.
- generalized poster helper: full URL pass-through vs TMDB path.
