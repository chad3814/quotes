# iqdb — Quote Database Design

**Date:** 2026-07-23
**Status:** Approved (design); implementation plan pending
**Author:** Chad Walker (with Claude)

## Summary

iqdb stores and serves quotes from movies, TV shows, and books. A quote is an
ordered set of media-relative *lines*; each line can attribute characters as
speaker or subject, with optional character offsets so a referenced character
can be linked inline. Quotes pin to a specific *edition* of a work and carry an
approximate position (timestamp for audio/video, chapter/page/percent for
books). The public site is read-only and curated; full-text search is the
primary browse path.

## Goals

- Serve a public, SEO-friendly website (read-only) with an API that falls out
  of the same model.
- Priority browse paths, in order: **full-text search**, **by character**,
  **by work**.
- First-class character attribution (speaker/subject) with inline-linkable
  subject spans.

## Non-goals (v1)

Explicitly deferred, and designed so each is a non-breaking later addition:

- People / portrayal (actors, authors, directors) and cast pages.
- Non-character entity subjects (objects, places, concepts such as "the Force").
- Splitting `SUBJECT` into `ADDRESSEE` vs `MENTIONED`.
- Community submissions, user accounts, moderation.
- Admin authoring UI.
- Semantic search (pgvector).

## Stack decisions

- **Next.js on Vercel** — website first, API falls out naturally.
- **Neon Postgres** — the data is a relational graph (Work → Edition → Quote →
  Line, plus many-to-many character attribution). Postgres covers all three
  priority paths in one system: native full-text search (`tsvector` + GIN) for
  search, shallow joins for character/work browse, and `pgvector` available
  later for semantic search. Use Neon's **pooled connection string** with a
  serverless-friendly driver so serverless functions don't exhaust connections.
- **Drizzle ORM** (+ drizzle-kit migrations) — SQL-first with strong inferred
  types, and it models Postgres-native features declaratively (generated
  `tsvector` column, GIN index, enums). Chosen over Prisma because the hero
  query is Postgres FTS (Prisma pushes that into raw SQL) and the `works` model
  is polymorphic (Prisma has no STI/polymorphic relations).

### Rejected alternatives

- **Document store (Mongo/Firestore):** the character graph is many-to-many;
  documents make "all quotes about character X across all works" a
  denormalization/consistency problem. Wrong shape.
- **Graph DB (Neo4j):** attribution is graph-y, but traversals are shallow
  (1–2 hops) and FTS is the hero path — graph DBs are weak at FTS and don't fit
  Vercel serverless cleanly. Overkill.
- **Search-first engine (Typesense/Algolia/Meili):** still need a relational
  source of truth; add later as a secondary index only if Postgres FTS
  underperforms (not expected at this scale).
- **Prisma:** friction lands exactly on the #1 path (FTS) and on polymorphism.
- **Separate per-media tables:** fights the #1 path — cross-media search and
  unified quote lists would need UNIONs across media.

## Entity model

Primary keys are opaque `cuid2` text ids. All tables carry `createdAt` /
`updatedAt`.

### `works` — unified, discriminated

| Column          | Type                                              | Notes |
|-----------------|---------------------------------------------------|-------|
| `id`            | text PK                                            | cuid2 |
| `type`          | enum `MOVIE` \| `TV_SERIES` \| `TV_EPISODE` \| `BOOK` | discriminator |
| `parentWorkId`  | text FK → `works.id`, nullable                     | episode → series |
| `title`         | text                                               | |
| `originalTitle` | text, nullable                                     | |
| `slug`          | text, unique                                       | SEO URL |
| `year`          | int, nullable                                      | release / publication year |
| `seasonNumber`  | int, nullable                                      | episodes |
| `episodeNumber` | int, nullable                                      | episodes |
| `synopsis`      | text, nullable                                     | |

Movies, books, and series are top-level. An episode carries `parentWorkId`
pointing at its series plus `seasonNumber` / `episodeNumber`. A TV series is
itself **not** quotable — only its episodes are. Type-specific attributes are a
small set of nullable columns (not JSONB) to keep types clean and queryable.

### `editions` — the coordinate space a quote pins to

| Column        | Type                          | Notes |
|---------------|-------------------------------|-------|
| `id`          | text PK                        | |
| `workId`      | text FK → `works.id`           | |
| `format`      | enum (see below)               | |
| `label`       | text, nullable                 | e.g. "1997 Special Edition", "Penguin Classics 2003" |
| `language`    | text, nullable                 | BCP-47 |
| `releaseDate` | date, nullable                 | |
| `runtimeMs`   | int, nullable                  | AV — validates timestamp positions |
| `pageCount`   | int, nullable                  | print — validates page positions |

`format` enum: `THEATRICAL`, `DIRECTORS_CUT`, `EXTENDED`, `REMASTER`,
`TV_BROADCAST`, `HARDCOVER`, `PAPERBACK`, `EBOOK`, `AUDIOBOOK`, `OTHER`. The
enum handles common filtering ("all director's cuts"); the free-text `label`
carries specifics.

Positioning is edition-relative because a timestamp only means something against
a specific cut, and a page number only against a specific printing.

### `quotes` — pins to an edition

| Column         | Type                             | Notes |
|----------------|----------------------------------|-------|
| `id`           | text PK                           | |
| `editionId`    | text FK → `editions.id`           | work reached via `edition.workId` |
| `slug`         | text, unique                      | |
| `startMs`      | int, nullable                     | AV position (start) |
| `endMs`        | int, nullable                     | AV position (end, for quotes spanning time) |
| `chapter`      | text, nullable                    | print/ebook — text to allow named chapters |
| `page`         | int, nullable                     | print |
| `percent`      | numeric(5,2), nullable            | ebook, 0–100 |
| `locationNote` | text, nullable                    | free text, e.g. "epilogue" |
| `searchText`   | text                              | denormalized from lines |
| `searchVector` | tsvector, `GENERATED … STORED`    | **GIN**-indexed |

Position is quote-level (one approximate anchor per quote), not per-line. Lines
are sequential within a quote, so a single anchor is sufficient; per-line
positioning is deliberately not modeled.

`searchVector` is a real generated column:
`to_tsvector('english', coalesce(searchText, ''))`. Because a generated column
cannot aggregate across line *rows*, `searchText` is maintained on write from
the quote's lines (concatenated `content` in `ordinal` order). Option, default
off: also append attributed character names to `searchText` to boost recall.

### `lines` — ordered content units

| Column    | Type                             | Notes |
|-----------|----------------------------------|-------|
| `id`      | text PK                           | |
| `quoteId` | text FK → `quotes.id`             | |
| `ordinal` | int                               | order within quote |
| `type`    | enum `DIALOG` \| `ON_SCREEN_TEXT` \| `STAGE_DIRECTION` \| `PROSE` | |
| `content` | text                              | up to a paragraph for `PROSE` |

Unique(`quoteId`, `ordinal`).

### `characters` — global / canonical

| Column        | Type          | Notes |
|---------------|---------------|-------|
| `id`          | text PK        | |
| `name`        | text           | |
| `slug`        | text, unique   | |
| `description` | text, nullable | |

A character is a single canonical entity referenced across every work it appears
in (e.g. "Luke Skywalker" across all Star Wars films/shows).

### `attributions` — the character graph (line-level)

| Column        | Type                          | Notes |
|---------------|-------------------------------|-------|
| `id`          | text PK                        | |
| `lineId`      | text FK → `lines.id`           | |
| `characterId` | text FK → `characters.id`      | |
| `role`        | enum `SPEAKER` \| `SUBJECT`    | |
| `start`       | int, nullable                  | offset into `line.content` |
| `end`         | int, nullable                  | offset into `line.content` |

- Spans are **0-indexed, half-open**: `content.substring(start, end)` yields the
  referenced text. Example: `"Use the Force, Luke. Let go.".substring(15, 19)`
  === `"Luke"`. Offsets are over the string as stored, in JS/UTF-16 code units;
  this differs from code points only for astral characters (emoji), which is
  documented and accepted.
- Spans are optional and per-row, so the same character referenced twice in one
  line is two rows with different spans. **No uniqueness** on
  `(lineId, characterId, role)`.
- **Partial unique index enforces at most one `SPEAKER` per line**
  (`UNIQUE (lineId) WHERE role = 'SPEAKER'`). `DIALOG` lines have one speaker;
  `ON_SCREEN_TEXT` / `STAGE_DIRECTION` / `PROSE` usually have none.
- `SUBJECT` is 0-to-many and covers both addressed ("...Luke") and mentioned
  ("Vader killed your father"). The `ADDRESSEE`/`MENTIONED` split is a
  non-breaking future addition to the `role` enum.

Example — the Obi-Wan quote is one `DIALOG` line,
`content: "Use the Force, Luke. Let go."`, with attributions:

```
[
  { characterId: <Obi-Wan>, role: SPEAKER },
  { characterId: <Luke>,    role: SUBJECT, start: 15, end: 19 }
]
```

### `external_references` — generic polymorphic

| Column       | Type                                              | Notes |
|--------------|---------------------------------------------------|-------|
| `id`         | text PK                                            | |
| `entityType` | enum `WORK` \| `CHARACTER` \| `EDITION` \| `PERSON` | `PERSON` reserved for later |
| `entityId`   | text                                               | app-enforced polymorphic ref |
| `provider`   | enum `TMDB` \| `IMDB` \| `IBDB` \| `WIKIPEDIA` \| `WIKIDATA` \| `OTHER` | |
| `externalId` | text                                               | provider's key |
| `url`        | text, nullable                                     | stored even when derivable, so links survive URL-scheme changes |

Unique(`provider`, `entityType`, `externalId`); index(`entityType`, `entityId`).
One table serves works, characters, and editions uniformly and adds providers
without migrations.

## Derived relationships (no extra tables)

- **Character → works** ("appears in"):
  `attributions → lines → quotes → editions → works`.
- **Character page**: quotes where the character is `SPEAKER` vs `SUBJECT`, by
  aggregating line attributions up to the parent quote.

Because "appears in" is derived from attributions, a character with no quotes
yet is not listed for a work — acceptable in v1. An explicit `appearance` join
is a clean later addition (arrives with People).

## Read paths

1. **Full-text search** (priority #1): `websearch_to_tsquery` against
   `quotes.searchVector`, ranked by `ts_rank`, snippet via `ts_headline` over
   `searchText`.
2. **Character page** (priority #2): `characters` by slug → attributions grouped
   by role → distinct quotes.
3. **Work page** (priority #3): `works` by slug → editions → quotes.
4. **Quote page**: quote by slug → ordered lines → attributions with spans →
   render subject spans as links to their character pages.

## Conventions

- **Slugs**: `works` / `characters` from title/name; `quotes` from leading
  content words plus a short id suffix for uniqueness
  (e.g. `use-the-force-luke-a1b2`). Opaque `cuid2` PKs underneath.
- **Ingest** (v1): curated. Work/edition metadata pulled from external providers
  (e.g. TMDB for movies/TV); quotes authored via seed/import scripts. No public
  write path. Authoring UI and community submissions are separate later specs
  built on this schema.

## Testing

Per project rules, new features require unit tests, and lint / type-check /
tests / build must pass before any commit.

- **Unit**: slug generation; `searchText` assembly from lines; attribution span
  validity (`substring(start, end)` is within bounds and non-empty when set);
  position validation against the edition's media type (timestamps require AV
  runtime context; page requires print `pageCount`; percent for ebook).
- **Integration**: FTS ranking and character-aggregation queries against a real
  Postgres (a Neon branch or local pg/pglite), since these rely on
  Postgres-specific behavior (tsvector, GIN, partial unique index).

## Open items for the implementation plan

- Exact Drizzle schema module layout and migration workflow (drizzle-kit).
- Neon serverless driver/adapter choice and connection handling on Vercel.
- Whether `searchText` maintenance is a repository-layer concern or a DB
  trigger (leaning repository-layer for testability).
