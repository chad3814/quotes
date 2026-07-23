# Quote Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the fully-tested Postgres/Drizzle data and query layer for iqdb — schema, migrations, domain utilities, write repositories, and the full-text-search / character / work read paths.

**Architecture:** A unified discriminated `works` table (movie/TV/book) with edition-relative quotes made of ordered lines; character attribution lives on lines (speaker/subject with optional inline spans). Reads are served by Postgres-native full-text search (`tsvector` + GIN) plus shallow join aggregation. Pure domain logic (slugs, search-text assembly, position/span validation) is isolated from I/O and unit-tested; repositories are integration-tested against real Postgres via PGlite.

**Tech Stack:** Next.js (App Router) on Vercel · Neon Postgres · Drizzle ORM + drizzle-kit · `@neondatabase/serverless` · `@paralleldrive/cuid2` · Vitest · `@electric-sql/pglite`.

**Scope:** Data + query layer only. Next.js pages/UI, the public API surface, and the TMDB/book ingest pipeline are follow-on plans that build on the repositories defined here.

**Source spec:** `docs/superpowers/specs/2026-07-23-quote-database-design.md`

## Global Constraints

- TypeScript `strict` mode; **no `any` and no `unknown`** as declared types.
- 2-space indentation; always terminate statements with semicolons.
- Postgres accessed through Neon's **pooled** connection string; runtime client uses `drizzle-orm/neon-serverless`.
- Primary keys are `cuid2` text ids (`@paralleldrive/cuid2`).
- Full-text search uses a generated `tsvector` column (`to_tsvector('english', …)`) with a GIN index; the `search_text` source column is maintained on write.
- Attribution spans are 0-indexed, half-open, in JS/UTF-16 code units (`content.substring(start, end)`).
- **Before every commit, `npm run verify` (lint + typecheck + test + build) must pass.** Fix unrelated breakage first — a commit is only allowed on a green tree.
- Commits are per-task. Execution is human-directed (subagent-driven with review between tasks); the human approves commits per their standing rule.

---

## File Structure

```
package.json                      # scripts + deps
tsconfig.json                     # strict TS, @/* alias
next.config.ts                    # minimal Next config
eslint.config.mjs                 # next + typescript lint
drizzle.config.ts                 # drizzle-kit config
vitest.config.ts                  # test runner + @/* alias
.gitignore                        # node/next/env
app/layout.tsx                    # minimal root layout (keeps `next build` valid)
app/page.tsx                      # minimal landing page
drizzle/                          # generated SQL migrations (committed)
src/
  db/
    schema.ts                     # enums, tables, relations, enum TS types
    types.ts                      # shared `Database` type
    client.ts                     # Neon serverless runtime client
    index.ts                      # re-exports (schema + client)
  lib/
    ids.ts                        # newId()
    slug.ts                       # slugify(), quoteSlugBase()
    search-text.ts                # buildSearchText()
    position.ts                   # Position type, validatePosition()
    attribution.ts                # validateSpan()
  repositories/
    slug-util.ts                  # ensureUniqueSlug()
    works.ts                      # createWork(), getWorkBySlug()
    editions.ts                   # createEdition()
    characters.ts                 # createCharacter(), getCharacterPageBySlug()
    quotes.ts                     # createQuote(), getQuoteBySlug()
    search.ts                     # searchQuotes()
tests/
  setup/test-db.ts                # PGlite + migrate harness: createTestDb()
  lib/slug.test.ts
  lib/search-text.test.ts
  lib/position.test.ts
  lib/attribution.test.ts
  db/schema.test.ts
  repositories/slug-util.test.ts
  repositories/entities.test.ts
  repositories/quotes.test.ts
  repositories/search.test.ts
  repositories/characters.test.ts
  repositories/works.test.ts
```

---

## Task 1: Project scaffold & tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `drizzle.config.ts`, `vitest.config.ts`, `.gitignore`, `app/layout.tsx`, `app/page.tsx`, `tests/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run verify` scripts; `@/*` path alias → `src/*`.

- [ ] **Step 1: Install dependencies**

Run from the repo root (`main` worktree):

```bash
npm init -y
npm install next@latest react@latest react-dom@latest drizzle-orm@latest @neondatabase/serverless@latest @paralleldrive/cuid2@latest
npm install -D typescript@latest @types/node@latest @types/react@latest @types/react-dom@latest drizzle-kit@latest vitest@latest @electric-sql/pglite@latest eslint@latest eslint-config-next@latest
```

- [ ] **Step 2: Write `package.json` scripts**

Replace the `"scripts"` block in `package.json` with:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "db:generate": "drizzle-kit generate",
    "verify": "npm run lint && npm run typecheck && npm run test -- --run && npm run build"
  }
}
```

- [ ] **Step 3: Write config files**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

`eslint.config.mjs`:

```javascript
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [...compat.extends("next/core-web-vitals", "next/typescript")];

export default eslintConfig;
```

(If `next lint` reports `@eslint/eslintrc` missing, run `npm install -D @eslint/eslintrc@latest`.)

`drizzle.config.ts`:

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
```

`vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: { globals: true, environment: "node" },
  resolve: { alias: { "@": resolve(__dirname, "./src") } },
});
```

`.gitignore`:

```
node_modules
.next
next-env.d.ts
.env*.local
*.tsbuildinfo
```

- [ ] **Step 4: Write minimal app so `next build` is valid**

`app/layout.tsx`:

```tsx
export const metadata = { title: "iqdb", description: "Quote database" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`app/page.tsx`:

```tsx
export default function Home() {
  return <main>iqdb</main>;
}
```

- [ ] **Step 5: Write the smoke test**

`tests/smoke.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

describe("smoke", () => {
  it("runs the test harness", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Verify the toolchain is green**

Run: `npm run verify`
Expected: lint passes, `tsc --noEmit` passes, the smoke test passes, `next build` succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + Drizzle + Vitest toolchain"
```

---

## Task 2: Database schema, migration & test harness

**Files:**
- Create: `src/db/schema.ts`, `src/db/types.ts`, `tests/setup/test-db.ts`, `tests/db/schema.test.ts`
- Create (generated): `drizzle/*.sql` + `drizzle/meta/*`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - Tables: `works`, `editions`, `quotes`, `lines`, `characters`, `attributions`, `externalReferences` (exported from `@/db/schema`).
  - Enums: `workType`, `editionFormat`, `lineType`, `attributionRole`, `entityType`, `referenceProvider`.
  - Enum TS types: `WorkType`, `EditionFormat`, `LineType`, `AttributionRole`, `EntityType`, `ReferenceProvider`.
  - `Database` type from `@/db/types`.
  - `createTestDb(): Promise<Database>` from `tests/setup/test-db.ts` — a migrated in-memory PGlite database.

- [ ] **Step 1: Write the schema**

`src/db/schema.ts`:

```typescript
import { relations, sql, type SQL } from "drizzle-orm";
import {
  customType,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const workType = pgEnum("work_type", ["MOVIE", "TV_SERIES", "TV_EPISODE", "BOOK"]);
export const editionFormat = pgEnum("edition_format", [
  "THEATRICAL",
  "DIRECTORS_CUT",
  "EXTENDED",
  "REMASTER",
  "TV_BROADCAST",
  "HARDCOVER",
  "PAPERBACK",
  "EBOOK",
  "AUDIOBOOK",
  "OTHER",
]);
export const lineType = pgEnum("line_type", ["DIALOG", "ON_SCREEN_TEXT", "STAGE_DIRECTION", "PROSE"]);
export const attributionRole = pgEnum("attribution_role", ["SPEAKER", "SUBJECT"]);
export const entityType = pgEnum("entity_type", ["WORK", "CHARACTER", "EDITION", "PERSON"]);
export const referenceProvider = pgEnum("reference_provider", [
  "TMDB",
  "IMDB",
  "IBDB",
  "WIKIPEDIA",
  "WIKIDATA",
  "OTHER",
]);

export type WorkType = (typeof workType.enumValues)[number];
export type EditionFormat = (typeof editionFormat.enumValues)[number];
export type LineType = (typeof lineType.enumValues)[number];
export type AttributionRole = (typeof attributionRole.enumValues)[number];
export type EntityType = (typeof entityType.enumValues)[number];
export type ReferenceProvider = (typeof referenceProvider.enumValues)[number];

export const works = pgTable(
  "works",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    type: workType("type").notNull(),
    parentWorkId: text("parent_work_id"),
    title: text("title").notNull(),
    originalTitle: text("original_title"),
    slug: text("slug").notNull().unique(),
    year: integer("year"),
    seasonNumber: integer("season_number"),
    episodeNumber: integer("episode_number"),
    synopsis: text("synopsis"),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.parentWorkId], foreignColumns: [t.id], name: "works_parent_fk" }).onDelete("set null"),
    index("works_parent_idx").on(t.parentWorkId),
    index("works_type_idx").on(t.type),
  ],
);

export const editions = pgTable(
  "editions",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    workId: text("work_id").notNull().references(() => works.id, { onDelete: "cascade" }),
    format: editionFormat("format").notNull(),
    label: text("label"),
    language: text("language"),
    releaseDate: date("release_date"),
    runtimeMs: integer("runtime_ms"),
    pageCount: integer("page_count"),
    ...timestamps,
  },
  (t) => [index("editions_work_idx").on(t.workId)],
);

export const quotes = pgTable(
  "quotes",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    editionId: text("edition_id").notNull().references(() => editions.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    startMs: integer("start_ms"),
    endMs: integer("end_ms"),
    chapter: text("chapter"),
    page: integer("page"),
    percent: numeric("percent", { precision: 5, scale: 2 }),
    locationNote: text("location_note"),
    searchText: text("search_text").notNull().default(""),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): SQL => sql`to_tsvector('english', coalesce(${quotes.searchText}, ''))`,
    ),
    ...timestamps,
  },
  (t) => [
    index("quotes_edition_idx").on(t.editionId),
    index("quotes_search_idx").using("gin", t.searchVector),
  ],
);

export const lines = pgTable(
  "lines",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    quoteId: text("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    type: lineType("type").notNull(),
    content: text("content").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("lines_quote_ordinal_uq").on(t.quoteId, t.ordinal)],
);

export const characters = pgTable("characters", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  ...timestamps,
});

export const attributions = pgTable(
  "attributions",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    lineId: text("line_id").notNull().references(() => lines.id, { onDelete: "cascade" }),
    characterId: text("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
    role: attributionRole("role").notNull(),
    start: integer("start"),
    end: integer("end"),
    ...timestamps,
  },
  (t) => [
    index("attributions_line_idx").on(t.lineId),
    index("attributions_character_role_idx").on(t.characterId, t.role),
    uniqueIndex("attributions_one_speaker_per_line_uq").on(t.lineId).where(sql`${t.role} = 'SPEAKER'`),
  ],
);

export const externalReferences = pgTable(
  "external_references",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    entityType: entityType("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    provider: referenceProvider("provider").notNull(),
    externalId: text("external_id").notNull(),
    url: text("url"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("external_references_uq").on(t.provider, t.entityType, t.externalId),
    index("external_references_entity_idx").on(t.entityType, t.entityId),
  ],
);

export const worksRelations = relations(works, ({ one, many }) => ({
  parent: one(works, { fields: [works.parentWorkId], references: [works.id], relationName: "work_parent" }),
  children: many(works, { relationName: "work_parent" }),
  editions: many(editions),
}));

export const editionsRelations = relations(editions, ({ one, many }) => ({
  work: one(works, { fields: [editions.workId], references: [works.id] }),
  quotes: many(quotes),
}));

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  edition: one(editions, { fields: [quotes.editionId], references: [editions.id] }),
  lines: many(lines),
}));

export const linesRelations = relations(lines, ({ one, many }) => ({
  quote: one(quotes, { fields: [lines.quoteId], references: [quotes.id] }),
  attributions: many(attributions),
}));

export const charactersRelations = relations(characters, ({ many }) => ({
  attributions: many(attributions),
}));

export const attributionsRelations = relations(attributions, ({ one }) => ({
  line: one(lines, { fields: [attributions.lineId], references: [lines.id] }),
  character: one(characters, { fields: [attributions.characterId], references: [characters.id] }),
}));
```

- [ ] **Step 2: Write the shared `Database` type**

`src/db/types.ts`:

```typescript
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

export type Schema = typeof schema;
export type Database = PgDatabase<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;
```

- [ ] **Step 3: Generate the migration**

Run: `npm run db:generate`
Expected: a new `drizzle/0000_*.sql` plus `drizzle/meta/*`. Open the SQL and confirm it contains: `to_tsvector('english', coalesce("search_text", ''))` as a `GENERATED ALWAYS AS (...) STORED` column, `USING gin ("search_vector")`, and `... "attributions" ("line_id") WHERE "role" = 'SPEAKER'`.

- [ ] **Step 4: Write the PGlite test harness**

`tests/setup/test-db.ts`:

```typescript
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Database } from "@/db/types";
import * as schema from "@/db/schema";

export async function createTestDb(): Promise<Database> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}
```

- [ ] **Step 5: Write the failing schema test**

`tests/db/schema.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { createTestDb } from "../setup/test-db";
import { attributions, characters, editions, lines, quotes, works } from "@/db/schema";

async function seedLine(db: Awaited<ReturnType<typeof createTestDb>>) {
  const [work] = await db.insert(works).values({ type: "MOVIE", title: "Star Wars", slug: "star-wars" }).returning();
  const [edition] = await db.insert(editions).values({ workId: work.id, format: "THEATRICAL" }).returning();
  const [quote] = await db
    .insert(quotes)
    .values({ editionId: edition.id, slug: "use-the-force-abcd1234", searchText: "Use the Force, Luke. Let go." })
    .returning();
  const [line] = await db
    .insert(lines)
    .values({ quoteId: quote.id, ordinal: 0, type: "DIALOG", content: "Use the Force, Luke. Let go." })
    .returning();
  return { work, edition, quote, line };
}

describe("schema", () => {
  it("populates the generated tsvector so search matches", async () => {
    const db = await createTestDb();
    const { quote } = await seedLine(db);
    const hits = await db
      .select({ id: quotes.id })
      .from(quotes)
      .where(and(eq(quotes.id, quote.id), sqlMatch()));
    expect(hits).toHaveLength(1);
  });

  it("enforces at most one SPEAKER attribution per line", async () => {
    const db = await createTestDb();
    const { line } = await seedLine(db);
    const [obiwan] = await db.insert(characters).values({ name: "Obi-Wan Kenobi", slug: "obi-wan-kenobi" }).returning();
    const [luke] = await db.insert(characters).values({ name: "Luke Skywalker", slug: "luke-skywalker" }).returning();
    await db.insert(attributions).values({ lineId: line.id, characterId: obiwan.id, role: "SPEAKER" });
    await expect(
      db.insert(attributions).values({ lineId: line.id, characterId: luke.id, role: "SPEAKER" }),
    ).rejects.toThrow();
  });

  it("allows multiple SUBJECT attributions per line", async () => {
    const db = await createTestDb();
    const { line } = await seedLine(db);
    const [a] = await db.insert(characters).values({ name: "A", slug: "a" }).returning();
    const [b] = await db.insert(characters).values({ name: "B", slug: "b" }).returning();
    await db.insert(attributions).values({ lineId: line.id, characterId: a.id, role: "SUBJECT", start: 15, end: 19 });
    await db.insert(attributions).values({ lineId: line.id, characterId: b.id, role: "SUBJECT" });
    const rows = await db.select().from(attributions).where(eq(attributions.lineId, line.id));
    expect(rows).toHaveLength(2);
  });
});
```

Add this import + helper at the top of the file (below the existing imports) so the tsvector match is expressed in raw SQL:

```typescript
import { sql } from "drizzle-orm";

function sqlMatch() {
  return sql`${quotes.searchVector} @@ websearch_to_tsquery('english', 'force')`;
}
```

- [ ] **Step 6: Run the schema test to verify it passes**

Run: `npm run test -- --run tests/db/schema.test.ts`
Expected: all three tests PASS. (If the generated tsvector test fails, re-check the generated migration SQL from Step 3.)

- [ ] **Step 7: Verify and commit**

```bash
npm run verify
git add -A
git commit -m "feat: add Drizzle schema, initial migration, and PGlite test harness"
```

---

## Task 3: ID and slug utilities

**Files:**
- Create: `src/lib/ids.ts`, `src/lib/slug.ts`, `tests/lib/slug.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `newId(): string`
  - `slugify(input: string): string`
  - `quoteSlugBase(lines: { ordinal: number; content: string }[]): string`

- [ ] **Step 1: Write the failing test**

`tests/lib/slug.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { quoteSlugBase, slugify } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases, trims, and hyphenates", () => {
    expect(slugify("  Star Wars: A New Hope!  ")).toBe("star-wars-a-new-hope");
  });

  it("collapses repeated separators and strips leading/trailing hyphens", () => {
    expect(slugify("--The   Office (US)--")).toBe("the-office-us");
  });

  it("returns an empty string for punctuation-only input", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("quoteSlugBase", () => {
  it("builds a base from the first line's leading words", () => {
    const base = quoteSlugBase([{ ordinal: 0, content: "Use the Force, Luke. Let go." }]);
    expect(base).toBe("use-the-force-luke-let-go");
  });

  it("uses the lowest-ordinal line and caps the word count", () => {
    const base = quoteSlugBase([
      { ordinal: 1, content: "second line here" },
      { ordinal: 0, content: "one two three four five six seven eight" },
    ]);
    expect(base).toBe("one-two-three-four-five-six");
  });

  it("falls back to 'quote' when the first line has no slug-able words", () => {
    expect(quoteSlugBase([{ ordinal: 0, content: "!!!" }])).toBe("quote");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/lib/slug.test.ts`
Expected: FAIL — cannot resolve `@/lib/slug`.

- [ ] **Step 3: Write the implementations**

`src/lib/ids.ts`:

```typescript
import { createId } from "@paralleldrive/cuid2";

export function newId(): string {
  return createId();
}
```

`src/lib/slug.ts`:

```typescript
const MAX_SLUG_WORDS = 6;

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function quoteSlugBase(lines: { ordinal: number; content: string }[]): string {
  const first = [...lines].sort((a, b) => a.ordinal - b.ordinal)[0];
  const slug = slugify(first?.content ?? "").split("-").filter(Boolean).slice(0, MAX_SLUG_WORDS).join("-");
  return slug.length > 0 ? slug : "quote";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/lib/slug.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify and commit**

```bash
npm run verify
git add -A
git commit -m "feat: add id and slug utilities"
```

---

## Task 4: Search-text assembly

**Files:**
- Create: `src/lib/search-text.ts`, `tests/lib/search-text.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `buildSearchText(lines: { ordinal: number; content: string }[]): string`

- [ ] **Step 1: Write the failing test**

`tests/lib/search-text.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { buildSearchText } from "@/lib/search-text";

describe("buildSearchText", () => {
  it("joins line contents in ordinal order with newlines", () => {
    const text = buildSearchText([
      { ordinal: 1, content: "I know." },
      { ordinal: 0, content: "I love you." },
    ]);
    expect(text).toBe("I love you.\nI know.");
  });

  it("returns an empty string for no lines", () => {
    expect(buildSearchText([])).toBe("");
  });

  it("trims each line and drops blank lines", () => {
    const text = buildSearchText([
      { ordinal: 0, content: "  hello  " },
      { ordinal: 1, content: "   " },
      { ordinal: 2, content: "world" },
    ]);
    expect(text).toBe("hello\nworld");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/lib/search-text.test.ts`
Expected: FAIL — cannot resolve `@/lib/search-text`.

- [ ] **Step 3: Write the implementation**

`src/lib/search-text.ts`:

```typescript
export function buildSearchText(lines: { ordinal: number; content: string }[]): string {
  return [...lines]
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((line) => line.content.trim())
    .filter((content) => content.length > 0)
    .join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/lib/search-text.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify and commit**

```bash
npm run verify
git add -A
git commit -m "feat: add search-text assembly"
```

---

## Task 5: Position validation

**Files:**
- Create: `src/lib/position.ts`, `tests/lib/position.test.ts`

**Interfaces:**
- Consumes: `EditionFormat` from `@/db/schema`.
- Produces:
  - `type Position = { startMs?: number | null; endMs?: number | null; chapter?: string | null; page?: number | null; percent?: number | null; locationNote?: string | null }`
  - `type EditionContext = { format: EditionFormat; runtimeMs: number | null; pageCount: number | null }`
  - `type ValidationResult = { ok: true } | { ok: false; error: string }`
  - `validatePosition(position: Position, edition: EditionContext): ValidationResult`

- [ ] **Step 1: Write the failing test**

`tests/lib/position.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { validatePosition } from "@/lib/position";

describe("validatePosition", () => {
  it("accepts a timestamp within an AV runtime", () => {
    const result = validatePosition(
      { startMs: 5000, endMs: 8000 },
      { format: "THEATRICAL", runtimeMs: 7_200_000, pageCount: null },
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects a timestamp past the runtime", () => {
    const result = validatePosition(
      { startMs: 9_000_000 },
      { format: "THEATRICAL", runtimeMs: 7_200_000, pageCount: null },
    );
    expect(result.ok).toBe(false);
  });

  it("rejects endMs before startMs", () => {
    const result = validatePosition(
      { startMs: 8000, endMs: 5000 },
      { format: "DIRECTORS_CUT", runtimeMs: null, pageCount: null },
    );
    expect(result.ok).toBe(false);
  });

  it("accepts a page within a print page count", () => {
    const result = validatePosition({ page: 42 }, { format: "HARDCOVER", runtimeMs: null, pageCount: 300 });
    expect(result).toEqual({ ok: true });
  });

  it("rejects a page beyond the page count", () => {
    const result = validatePosition({ page: 500 }, { format: "PAPERBACK", runtimeMs: null, pageCount: 300 });
    expect(result.ok).toBe(false);
  });

  it("rejects a percent outside 0..100 for ebooks", () => {
    const result = validatePosition({ percent: 150 }, { format: "EBOOK", runtimeMs: null, pageCount: null });
    expect(result.ok).toBe(false);
  });

  it("accepts an empty position", () => {
    expect(validatePosition({}, { format: "THEATRICAL", runtimeMs: null, pageCount: null })).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/lib/position.test.ts`
Expected: FAIL — cannot resolve `@/lib/position`.

- [ ] **Step 3: Write the implementation**

`src/lib/position.ts`:

```typescript
import type { EditionFormat } from "@/db/schema";

export type Position = {
  startMs?: number | null;
  endMs?: number | null;
  chapter?: string | null;
  page?: number | null;
  percent?: number | null;
  locationNote?: string | null;
};

export type EditionContext = {
  format: EditionFormat;
  runtimeMs: number | null;
  pageCount: number | null;
};

export type ValidationResult = { ok: true } | { ok: false; error: string };

const TIME_BASED: ReadonlySet<EditionFormat> = new Set<EditionFormat>([
  "THEATRICAL",
  "DIRECTORS_CUT",
  "EXTENDED",
  "REMASTER",
  "TV_BROADCAST",
  "AUDIOBOOK",
]);

function fail(error: string): ValidationResult {
  return { ok: false, error };
}

export function validatePosition(position: Position, edition: EditionContext): ValidationResult {
  const { startMs, endMs, page, percent } = position;

  if (startMs != null) {
    if (startMs < 0) return fail("startMs must be >= 0");
    if (!TIME_BASED.has(edition.format)) return fail(`startMs is not valid for format ${edition.format}`);
    if (edition.runtimeMs != null && startMs > edition.runtimeMs) return fail("startMs exceeds edition runtime");
  }
  if (endMs != null) {
    if (startMs == null) return fail("endMs requires startMs");
    if (endMs < startMs) return fail("endMs must be >= startMs");
    if (edition.runtimeMs != null && endMs > edition.runtimeMs) return fail("endMs exceeds edition runtime");
  }
  if (page != null) {
    if (page < 1) return fail("page must be >= 1");
    if (edition.pageCount != null && page > edition.pageCount) return fail("page exceeds edition page count");
  }
  if (percent != null && (percent < 0 || percent > 100)) {
    return fail("percent must be between 0 and 100");
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/lib/position.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify and commit**

```bash
npm run verify
git add -A
git commit -m "feat: add position validation"
```

---

## Task 6: Attribution span validation

**Files:**
- Create: `src/lib/attribution.ts`, `tests/lib/attribution.test.ts`

**Interfaces:**
- Consumes: `ValidationResult` from `@/lib/position`.
- Produces: `validateSpan(content: string, start: number | null | undefined, end: number | null | undefined): ValidationResult`

- [ ] **Step 1: Write the failing test**

`tests/lib/attribution.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { validateSpan } from "@/lib/attribution";

const CONTENT = "Use the Force, Luke. Let go.";

describe("validateSpan", () => {
  it("accepts a span that resolves to the referenced text", () => {
    expect(validateSpan(CONTENT, 15, 19)).toEqual({ ok: true });
  });

  it("accepts a fully-absent span (both null)", () => {
    expect(validateSpan(CONTENT, null, null)).toEqual({ ok: true });
    expect(validateSpan(CONTENT, undefined, undefined)).toEqual({ ok: true });
  });

  it("rejects a half-specified span", () => {
    expect(validateSpan(CONTENT, 15, null).ok).toBe(false);
    expect(validateSpan(CONTENT, null, 19).ok).toBe(false);
  });

  it("rejects start >= end", () => {
    expect(validateSpan(CONTENT, 19, 19).ok).toBe(false);
    expect(validateSpan(CONTENT, 19, 15).ok).toBe(false);
  });

  it("rejects out-of-bounds offsets", () => {
    expect(validateSpan(CONTENT, -1, 4).ok).toBe(false);
    expect(validateSpan(CONTENT, 0, CONTENT.length + 1).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/lib/attribution.test.ts`
Expected: FAIL — cannot resolve `@/lib/attribution`.

- [ ] **Step 3: Write the implementation**

`src/lib/attribution.ts`:

```typescript
import type { ValidationResult } from "@/lib/position";

export function validateSpan(
  content: string,
  start: number | null | undefined,
  end: number | null | undefined,
): ValidationResult {
  const hasStart = start != null;
  const hasEnd = end != null;
  if (!hasStart && !hasEnd) return { ok: true };
  if (hasStart !== hasEnd) return { ok: false, error: "span requires both start and end" };
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    return { ok: false, error: "span offsets must be integers" };
  }
  if (start! < 0 || end! > content.length) return { ok: false, error: "span is out of bounds" };
  if (start! >= end!) return { ok: false, error: "span start must be less than end" };
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/lib/attribution.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify and commit**

```bash
npm run verify
git add -A
git commit -m "feat: add attribution span validation"
```

---

## Task 7: Unique-slug repository helper

**Files:**
- Create: `src/repositories/slug-util.ts`, `tests/repositories/slug-util.test.ts`

**Interfaces:**
- Consumes: `Database` from `@/db/types`; `works`, `characters`, `quotes` from `@/db/schema`.
- Produces: `ensureUniqueSlug(db: Database, table: "works" | "characters" | "quotes", base: string): Promise<string>`

- [ ] **Step 1: Write the failing test**

`tests/repositories/slug-util.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { createTestDb } from "../setup/test-db";
import { characters } from "@/db/schema";
import { ensureUniqueSlug } from "@/repositories/slug-util";

describe("ensureUniqueSlug", () => {
  it("returns the base when unused", async () => {
    const db = await createTestDb();
    expect(await ensureUniqueSlug(db, "characters", "luke-skywalker")).toBe("luke-skywalker");
  });

  it("appends an incrementing suffix on collision", async () => {
    const db = await createTestDb();
    await db.insert(characters).values({ name: "Luke", slug: "luke-skywalker" });
    expect(await ensureUniqueSlug(db, "characters", "luke-skywalker")).toBe("luke-skywalker-2");
    await db.insert(characters).values({ name: "Luke 2", slug: "luke-skywalker-2" });
    expect(await ensureUniqueSlug(db, "characters", "luke-skywalker")).toBe("luke-skywalker-3");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/repositories/slug-util.test.ts`
Expected: FAIL — cannot resolve `@/repositories/slug-util`.

- [ ] **Step 3: Write the implementation**

`src/repositories/slug-util.ts`:

```typescript
import { eq } from "drizzle-orm";
import type { Database } from "@/db/types";
import { characters, quotes, works } from "@/db/schema";

const TABLES = { works, characters, quotes };

export async function ensureUniqueSlug(
  db: Database,
  table: "works" | "characters" | "quotes",
  base: string,
): Promise<string> {
  const t = TABLES[table];
  let candidate = base;
  let n = 1;
  for (;;) {
    const existing = await db.select({ id: t.id }).from(t).where(eq(t.slug, candidate)).limit(1);
    if (existing.length === 0) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/repositories/slug-util.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify and commit**

```bash
npm run verify
git add -A
git commit -m "feat: add ensureUniqueSlug helper"
```

---

## Task 8: Entity write repositories (works, editions, characters)

**Files:**
- Create: `src/repositories/works.ts`, `src/repositories/editions.ts`, `src/repositories/characters.ts`, `tests/repositories/entities.test.ts`

**Interfaces:**
- Consumes: `Database`, `ensureUniqueSlug`, `slugify`, `newId`; schema tables/enums.
- Produces:
  - `createWork(db: Database, input: CreateWorkInput): Promise<{ id: string; slug: string }>`
    where `CreateWorkInput = { type: WorkType; title: string; originalTitle?: string; parentWorkId?: string; year?: number; seasonNumber?: number; episodeNumber?: number; synopsis?: string; slug?: string }`
  - `createEdition(db: Database, input: CreateEditionInput): Promise<{ id: string }>`
    where `CreateEditionInput = { workId: string; format: EditionFormat; label?: string; language?: string; releaseDate?: string; runtimeMs?: number; pageCount?: number }`
  - `createCharacter(db: Database, input: CreateCharacterInput): Promise<{ id: string; slug: string }>`
    where `CreateCharacterInput = { name: string; description?: string; slug?: string }`

- [ ] **Step 1: Write the failing test**

`tests/repositories/entities.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../setup/test-db";
import { editions, works } from "@/db/schema";
import { createWork } from "@/repositories/works";
import { createEdition } from "@/repositories/editions";
import { createCharacter } from "@/repositories/characters";

describe("createWork", () => {
  it("derives a slug from the title", async () => {
    const db = await createTestDb();
    const work = await createWork(db, { type: "MOVIE", title: "A New Hope" });
    expect(work.slug).toBe("a-new-hope");
    const [row] = await db.select().from(works).where(eq(works.id, work.id));
    expect(row.type).toBe("MOVIE");
  });

  it("de-duplicates slugs across works", async () => {
    const db = await createTestDb();
    const first = await createWork(db, { type: "MOVIE", title: "Dune" });
    const second = await createWork(db, { type: "BOOK", title: "Dune" });
    expect(first.slug).toBe("dune");
    expect(second.slug).toBe("dune-2");
  });
});

describe("createEdition", () => {
  it("attaches an edition to a work", async () => {
    const db = await createTestDb();
    const work = await createWork(db, { type: "MOVIE", title: "A New Hope" });
    const edition = await createEdition(db, { workId: work.id, format: "THEATRICAL", runtimeMs: 7_200_000 });
    const [row] = await db.select().from(editions).where(eq(editions.id, edition.id));
    expect(row.workId).toBe(work.id);
    expect(row.runtimeMs).toBe(7_200_000);
  });
});

describe("createCharacter", () => {
  it("derives a slug from the name", async () => {
    const db = await createTestDb();
    const character = await createCharacter(db, { name: "Obi-Wan Kenobi" });
    expect(character.slug).toBe("obi-wan-kenobi");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/repositories/entities.test.ts`
Expected: FAIL — cannot resolve the repository modules.

- [ ] **Step 3: Write the implementations**

`src/repositories/works.ts`:

```typescript
import type { Database } from "@/db/types";
import type { WorkType } from "@/db/schema";
import { works } from "@/db/schema";
import { slugify } from "@/lib/slug";
import { ensureUniqueSlug } from "@/repositories/slug-util";

export type CreateWorkInput = {
  type: WorkType;
  title: string;
  originalTitle?: string;
  parentWorkId?: string;
  year?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  synopsis?: string;
  slug?: string;
};

export async function createWork(db: Database, input: CreateWorkInput): Promise<{ id: string; slug: string }> {
  const slug = await ensureUniqueSlug(db, "works", input.slug ?? slugify(input.title));
  const [row] = await db
    .insert(works)
    .values({
      type: input.type,
      title: input.title,
      originalTitle: input.originalTitle ?? null,
      parentWorkId: input.parentWorkId ?? null,
      year: input.year ?? null,
      seasonNumber: input.seasonNumber ?? null,
      episodeNumber: input.episodeNumber ?? null,
      synopsis: input.synopsis ?? null,
      slug,
    })
    .returning({ id: works.id, slug: works.slug });
  return row;
}
```

`src/repositories/editions.ts`:

```typescript
import type { Database } from "@/db/types";
import type { EditionFormat } from "@/db/schema";
import { editions } from "@/db/schema";

export type CreateEditionInput = {
  workId: string;
  format: EditionFormat;
  label?: string;
  language?: string;
  releaseDate?: string;
  runtimeMs?: number;
  pageCount?: number;
};

export async function createEdition(db: Database, input: CreateEditionInput): Promise<{ id: string }> {
  const [row] = await db
    .insert(editions)
    .values({
      workId: input.workId,
      format: input.format,
      label: input.label ?? null,
      language: input.language ?? null,
      releaseDate: input.releaseDate ?? null,
      runtimeMs: input.runtimeMs ?? null,
      pageCount: input.pageCount ?? null,
    })
    .returning({ id: editions.id });
  return row;
}
```

`src/repositories/characters.ts`:

```typescript
import type { Database } from "@/db/types";
import { characters } from "@/db/schema";
import { slugify } from "@/lib/slug";
import { ensureUniqueSlug } from "@/repositories/slug-util";

export type CreateCharacterInput = {
  name: string;
  description?: string;
  slug?: string;
};

export async function createCharacter(
  db: Database,
  input: CreateCharacterInput,
): Promise<{ id: string; slug: string }> {
  const slug = await ensureUniqueSlug(db, "characters", input.slug ?? slugify(input.name));
  const [row] = await db
    .insert(characters)
    .values({ name: input.name, description: input.description ?? null, slug })
    .returning({ id: characters.id, slug: characters.slug });
  return row;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/repositories/entities.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify and commit**

```bash
npm run verify
git add -A
git commit -m "feat: add work, edition, and character write repositories"
```

---

## Task 9: Quote write repository & detail read

**Files:**
- Create: `src/repositories/quotes.ts`, `tests/repositories/quotes.test.ts`

**Interfaces:**
- Consumes: `Database`; `createWork`, `createEdition`, `createCharacter`; `buildSearchText`, `quoteSlugBase`, `validatePosition`, `validateSpan`, `ensureUniqueSlug`; schema tables; `Position`, `LineType`, `AttributionRole`.
- Produces:
  - `type CreateAttributionInput = { characterId: string; role: AttributionRole; start?: number | null; end?: number | null }`
  - `type CreateLineInput = { type: LineType; content: string; attributions?: CreateAttributionInput[] }`
  - `type CreateQuoteInput = { editionId: string; position?: Position; slugBase?: string; lines: CreateLineInput[] }`
  - `createQuote(db: Database, input: CreateQuoteInput): Promise<{ id: string; slug: string }>`
  - `type QuoteDetail = { id: string; slug: string; lines: { ordinal: number; type: LineType; content: string; attributions: { characterId: string; characterName: string; characterSlug: string; role: AttributionRole; start: number | null; end: number | null }[] }[] }`
  - `getQuoteBySlug(db: Database, slug: string): Promise<QuoteDetail | null>`

- [ ] **Step 1: Write the failing test**

`tests/repositories/quotes.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../setup/test-db";
import { quotes } from "@/db/schema";
import { createWork } from "@/repositories/works";
import { createEdition } from "@/repositories/editions";
import { createCharacter } from "@/repositories/characters";
import { createQuote, getQuoteBySlug } from "@/repositories/quotes";

async function arrange(db: Awaited<ReturnType<typeof createTestDb>>) {
  const work = await createWork(db, { type: "MOVIE", title: "A New Hope" });
  const edition = await createEdition(db, { workId: work.id, format: "THEATRICAL", runtimeMs: 7_200_000 });
  const obiwan = await createCharacter(db, { name: "Obi-Wan Kenobi" });
  const luke = await createCharacter(db, { name: "Luke Skywalker" });
  return { edition, obiwan, luke };
}

describe("createQuote", () => {
  it("creates a quote with lines, attributions, slug, and search text", async () => {
    const db = await createTestDb();
    const { edition, obiwan, luke } = await arrange(db);
    const created = await createQuote(db, {
      editionId: edition.id,
      position: { startMs: 5000 },
      lines: [
        {
          type: "DIALOG",
          content: "Use the Force, Luke. Let go.",
          attributions: [
            { characterId: obiwan.id, role: "SPEAKER" },
            { characterId: luke.id, role: "SUBJECT", start: 15, end: 19 },
          ],
        },
      ],
    });
    expect(created.slug).toBe("use-the-force-luke-let-go");
    const [row] = await db.select().from(quotes).where(eq(quotes.id, created.id));
    expect(row.searchText).toBe("Use the Force, Luke. Let go.");
    expect(row.startMs).toBe(5000);
  });

  it("rejects an invalid subject span", async () => {
    const db = await createTestDb();
    const { edition, luke } = await arrange(db);
    await expect(
      createQuote(db, {
        editionId: edition.id,
        lines: [{ type: "DIALOG", content: "short", attributions: [{ characterId: luke.id, role: "SUBJECT", start: 1, end: 99 }] }],
      }),
    ).rejects.toThrow();
    expect(await db.select().from(quotes)).toHaveLength(0);
  });

  it("rejects a position that is invalid for the edition", async () => {
    const db = await createTestDb();
    const { edition } = await arrange(db);
    await expect(
      createQuote(db, {
        editionId: edition.id,
        position: { startMs: 9_000_000 },
        lines: [{ type: "DIALOG", content: "Use the Force." }],
      }),
    ).rejects.toThrow();
  });
});

describe("getQuoteBySlug", () => {
  it("returns the quote with ordered lines and resolved attributions", async () => {
    const db = await createTestDb();
    const { edition, obiwan, luke } = await arrange(db);
    const created = await createQuote(db, {
      editionId: edition.id,
      lines: [
        {
          type: "DIALOG",
          content: "Use the Force, Luke. Let go.",
          attributions: [
            { characterId: obiwan.id, role: "SPEAKER" },
            { characterId: luke.id, role: "SUBJECT", start: 15, end: 19 },
          ],
        },
      ],
    });
    const detail = await getQuoteBySlug(db, created.slug);
    expect(detail).not.toBeNull();
    expect(detail?.lines).toHaveLength(1);
    const subject = detail?.lines[0].attributions.find((a) => a.role === "SUBJECT");
    expect(subject?.characterName).toBe("Luke Skywalker");
    expect(subject?.start).toBe(15);
  });

  it("returns null for an unknown slug", async () => {
    const db = await createTestDb();
    expect(await getQuoteBySlug(db, "nope")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/repositories/quotes.test.ts`
Expected: FAIL — cannot resolve `@/repositories/quotes`.

- [ ] **Step 3: Write the implementation**

`src/repositories/quotes.ts`:

```typescript
import { eq } from "drizzle-orm";
import type { Database } from "@/db/types";
import type { AttributionRole, LineType } from "@/db/schema";
import { attributions, editions, lines, quotes } from "@/db/schema";
import { buildSearchText } from "@/lib/search-text";
import { quoteSlugBase } from "@/lib/slug";
import { validatePosition, type Position } from "@/lib/position";
import { validateSpan } from "@/lib/attribution";
import { ensureUniqueSlug } from "@/repositories/slug-util";

export type CreateAttributionInput = {
  characterId: string;
  role: AttributionRole;
  start?: number | null;
  end?: number | null;
};

export type CreateLineInput = {
  type: LineType;
  content: string;
  attributions?: CreateAttributionInput[];
};

export type CreateQuoteInput = {
  editionId: string;
  position?: Position;
  slugBase?: string;
  lines: CreateLineInput[];
};

export async function createQuote(db: Database, input: CreateQuoteInput): Promise<{ id: string; slug: string }> {
  if (input.lines.length === 0) throw new Error("a quote requires at least one line");

  for (const line of input.lines) {
    for (const attr of line.attributions ?? []) {
      const span = validateSpan(line.content, attr.start, attr.end);
      if (!span.ok) throw new Error(span.error);
    }
  }

  const edition = await db
    .select({ format: editions.format, runtimeMs: editions.runtimeMs, pageCount: editions.pageCount })
    .from(editions)
    .where(eq(editions.id, input.editionId))
    .limit(1);
  if (edition.length === 0) throw new Error(`edition not found: ${input.editionId}`);
  if (input.position) {
    const pos = validatePosition(input.position, edition[0]);
    if (!pos.ok) throw new Error(pos.error);
  }

  const ordered = input.lines.map((line, index) => ({ ...line, ordinal: index }));
  const searchText = buildSearchText(ordered);
  const base = input.slugBase ?? quoteSlugBase(ordered);
  const position = input.position ?? {};

  return db.transaction(async (tx) => {
    const slug = await ensureUniqueSlug(tx, "quotes", base);
    const [quote] = await tx
      .insert(quotes)
      .values({
        editionId: input.editionId,
        slug,
        searchText,
        startMs: position.startMs ?? null,
        endMs: position.endMs ?? null,
        chapter: position.chapter ?? null,
        page: position.page ?? null,
        percent: position.percent != null ? String(position.percent) : null,
        locationNote: position.locationNote ?? null,
      })
      .returning({ id: quotes.id, slug: quotes.slug });

    for (const line of ordered) {
      const [row] = await tx
        .insert(lines)
        .values({ quoteId: quote.id, ordinal: line.ordinal, type: line.type, content: line.content })
        .returning({ id: lines.id });
      for (const attr of line.attributions ?? []) {
        await tx.insert(attributions).values({
          lineId: row.id,
          characterId: attr.characterId,
          role: attr.role,
          start: attr.start ?? null,
          end: attr.end ?? null,
        });
      }
    }

    return quote;
  });
}

export type QuoteDetail = {
  id: string;
  slug: string;
  lines: {
    ordinal: number;
    type: LineType;
    content: string;
    attributions: {
      characterId: string;
      characterName: string;
      characterSlug: string;
      role: AttributionRole;
      start: number | null;
      end: number | null;
    }[];
  }[];
};

export async function getQuoteBySlug(db: Database, slug: string): Promise<QuoteDetail | null> {
  const quote = await db.query.quotes.findFirst({
    where: eq(quotes.slug, slug),
    with: {
      lines: {
        orderBy: (line, { asc }) => [asc(line.ordinal)],
        with: { attributions: { with: { character: true } } },
      },
    },
  });
  if (!quote) return null;

  return {
    id: quote.id,
    slug: quote.slug,
    lines: quote.lines.map((line) => ({
      ordinal: line.ordinal,
      type: line.type,
      content: line.content,
      attributions: line.attributions.map((attr) => ({
        characterId: attr.characterId,
        characterName: attr.character.name,
        characterSlug: attr.character.slug,
        role: attr.role,
        start: attr.start,
        end: attr.end,
      })),
    })),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/repositories/quotes.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify and commit**

```bash
npm run verify
git add -A
git commit -m "feat: add quote write repository and detail read"
```

---

## Task 10: Full-text search query

**Files:**
- Create: `src/repositories/search.ts`, `tests/repositories/search.test.ts`

**Interfaces:**
- Consumes: `Database`; `createWork`, `createEdition`, `createQuote`.
- Produces:
  - `type SearchResult = { id: string; slug: string; headline: string; rank: number }`
  - `searchQuotes(db: Database, query: string, limit?: number): Promise<SearchResult[]>`

- [ ] **Step 1: Write the failing test**

`tests/repositories/search.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { createTestDb } from "../setup/test-db";
import { createWork } from "@/repositories/works";
import { createEdition } from "@/repositories/editions";
import { createQuote } from "@/repositories/quotes";
import { searchQuotes } from "@/repositories/search";

async function seed(db: Awaited<ReturnType<typeof createTestDb>>) {
  const work = await createWork(db, { type: "MOVIE", title: "A New Hope" });
  const edition = await createEdition(db, { workId: work.id, format: "THEATRICAL", runtimeMs: 7_200_000 });
  await createQuote(db, { editionId: edition.id, lines: [{ type: "DIALOG", content: "Use the Force, Luke." }] });
  await createQuote(db, { editionId: edition.id, lines: [{ type: "DIALOG", content: "I have a bad feeling about this." }] });
}

describe("searchQuotes", () => {
  it("matches on content and returns a highlighted headline", async () => {
    const db = await createTestDb();
    await seed(db);
    const results = await searchQuotes(db, "force");
    expect(results).toHaveLength(1);
    expect(results[0].headline.toLowerCase()).toContain("<b>force</b>");
    expect(results[0].rank).toBeGreaterThan(0);
  });

  it("returns nothing for a non-matching query", async () => {
    const db = await createTestDb();
    await seed(db);
    expect(await searchQuotes(db, "wookiee")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/repositories/search.test.ts`
Expected: FAIL — cannot resolve `@/repositories/search`.

- [ ] **Step 3: Write the implementation**

`src/repositories/search.ts`:

```typescript
import { sql } from "drizzle-orm";
import type { Database } from "@/db/types";

export type SearchResult = {
  id: string;
  slug: string;
  headline: string;
  rank: number;
};

export async function searchQuotes(db: Database, query: string, limit = 20): Promise<SearchResult[]> {
  const result = await db.execute(sql`
    select
      q.id as id,
      q.slug as slug,
      ts_headline('english', q.search_text, websearch_to_tsquery('english', ${query})) as headline,
      ts_rank(q.search_vector, websearch_to_tsquery('english', ${query})) as rank
    from quotes q
    where q.search_vector @@ websearch_to_tsquery('english', ${query})
    order by rank desc
    limit ${limit}
  `);

  return result.rows.map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    headline: String(row.headline),
    rank: Number(row.rank),
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/repositories/search.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify and commit**

```bash
npm run verify
git add -A
git commit -m "feat: add full-text quote search"
```

---

## Task 11: Character page aggregation

**Files:**
- Modify: `src/repositories/characters.ts`
- Create: `tests/repositories/characters.test.ts`

**Interfaces:**
- Consumes: `Database`; `createWork`, `createEdition`, `createCharacter`, `createQuote`; schema tables.
- Produces:
  - `type QuoteSummary = { id: string; slug: string; preview: string }`
  - `type CharacterPage = { character: { id: string; name: string; slug: string; description: string | null }; asSpeaker: QuoteSummary[]; asSubject: QuoteSummary[] }`
  - `getCharacterPageBySlug(db: Database, slug: string): Promise<CharacterPage | null>`

- [ ] **Step 1: Write the failing test**

`tests/repositories/characters.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { createTestDb } from "../setup/test-db";
import { createWork } from "@/repositories/works";
import { createEdition } from "@/repositories/editions";
import { createCharacter, getCharacterPageBySlug } from "@/repositories/characters";
import { createQuote } from "@/repositories/quotes";

describe("getCharacterPageBySlug", () => {
  it("groups quotes by speaker vs subject", async () => {
    const db = await createTestDb();
    const work = await createWork(db, { type: "MOVIE", title: "A New Hope" });
    const edition = await createEdition(db, { workId: work.id, format: "THEATRICAL", runtimeMs: 7_200_000 });
    const obiwan = await createCharacter(db, { name: "Obi-Wan Kenobi" });
    const luke = await createCharacter(db, { name: "Luke Skywalker" });

    await createQuote(db, {
      editionId: edition.id,
      lines: [
        {
          type: "DIALOG",
          content: "Use the Force, Luke.",
          attributions: [
            { characterId: obiwan.id, role: "SPEAKER" },
            { characterId: luke.id, role: "SUBJECT", start: 15, end: 19 },
          ],
        },
      ],
    });
    await createQuote(db, {
      editionId: edition.id,
      lines: [{ type: "DIALOG", content: "I'll try.", attributions: [{ characterId: luke.id, role: "SPEAKER" }] }],
    });

    const page = await getCharacterPageBySlug(db, luke.slug);
    expect(page?.character.name).toBe("Luke Skywalker");
    expect(page?.asSpeaker).toHaveLength(1);
    expect(page?.asSubject).toHaveLength(1);
    expect(page?.asSpeaker[0].preview).toContain("I'll try.");
  });

  it("returns null for an unknown character", async () => {
    const db = await createTestDb();
    expect(await getCharacterPageBySlug(db, "nobody")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/repositories/characters.test.ts`
Expected: FAIL — `getCharacterPageBySlug` is not exported.

- [ ] **Step 3: Add the implementation**

Append to `src/repositories/characters.ts` (keep the existing `createCharacter`; add these imports to the top and the new exports below):

```typescript
import { and, eq } from "drizzle-orm";
import type { AttributionRole } from "@/db/schema";
import { attributions, lines, quotes } from "@/db/schema";

export type QuoteSummary = { id: string; slug: string; preview: string };

export type CharacterPage = {
  character: { id: string; name: string; slug: string; description: string | null };
  asSpeaker: QuoteSummary[];
  asSubject: QuoteSummary[];
};

const PREVIEW_LENGTH = 160;

function preview(searchText: string): string {
  const flat = searchText.replace(/\n/g, " ").trim();
  return flat.length <= PREVIEW_LENGTH ? flat : `${flat.slice(0, PREVIEW_LENGTH - 1)}…`;
}

export async function getCharacterPageBySlug(db: Database, slug: string): Promise<CharacterPage | null> {
  const character = await db.query.characters.findFirst({ where: eq(characters.slug, slug) });
  if (!character) return null;

  const quotesForRole = async (role: AttributionRole): Promise<QuoteSummary[]> => {
    const rows = await db
      .selectDistinct({ id: quotes.id, slug: quotes.slug, searchText: quotes.searchText })
      .from(attributions)
      .innerJoin(lines, eq(attributions.lineId, lines.id))
      .innerJoin(quotes, eq(lines.quoteId, quotes.id))
      .where(and(eq(attributions.characterId, character.id), eq(attributions.role, role)));
    return rows.map((row) => ({ id: row.id, slug: row.slug, preview: preview(row.searchText) }));
  };

  return {
    character: {
      id: character.id,
      name: character.name,
      slug: character.slug,
      description: character.description,
    },
    asSpeaker: await quotesForRole("SPEAKER"),
    asSubject: await quotesForRole("SUBJECT"),
  };
}
```

Note: `Database` and `characters` are already imported at the top of the file from Task 8 — do not duplicate those imports.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/repositories/characters.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify and commit**

```bash
npm run verify
git add -A
git commit -m "feat: add character page aggregation"
```

---

## Task 12: Work page read

**Files:**
- Modify: `src/repositories/works.ts`
- Create: `tests/repositories/works.test.ts`

**Interfaces:**
- Consumes: `Database`; `createWork`, `createEdition`, `createQuote`; schema.
- Produces:
  - `type WorkPage = { id: string; type: WorkType; title: string; slug: string; year: number | null; editions: { id: string; format: EditionFormat; label: string | null; quotes: { id: string; slug: string; preview: string }[] }[] }`
  - `getWorkBySlug(db: Database, slug: string): Promise<WorkPage | null>`

- [ ] **Step 1: Write the failing test**

`tests/repositories/works.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { createTestDb } from "../setup/test-db";
import { createWork, getWorkBySlug } from "@/repositories/works";
import { createEdition } from "@/repositories/editions";
import { createQuote } from "@/repositories/quotes";

describe("getWorkBySlug", () => {
  it("returns the work with its editions and their quotes", async () => {
    const db = await createTestDb();
    const work = await createWork(db, { type: "MOVIE", title: "A New Hope", year: 1977 });
    const edition = await createEdition(db, { workId: work.id, format: "THEATRICAL", runtimeMs: 7_200_000 });
    await createQuote(db, { editionId: edition.id, lines: [{ type: "DIALOG", content: "Use the Force, Luke." }] });

    const page = await getWorkBySlug(db, work.slug);
    expect(page?.title).toBe("A New Hope");
    expect(page?.year).toBe(1977);
    expect(page?.editions).toHaveLength(1);
    expect(page?.editions[0].quotes).toHaveLength(1);
    expect(page?.editions[0].quotes[0].preview).toContain("Use the Force");
  });

  it("returns null for an unknown work", async () => {
    const db = await createTestDb();
    expect(await getWorkBySlug(db, "nope")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/repositories/works.test.ts`
Expected: FAIL — `getWorkBySlug` is not exported.

- [ ] **Step 3: Add the implementation**

Append to `src/repositories/works.ts` (keep the existing `createWork`; add these imports to the top and the new exports below):

```typescript
import { eq } from "drizzle-orm";
import type { EditionFormat, WorkType } from "@/db/schema";

export type WorkPage = {
  id: string;
  type: WorkType;
  title: string;
  slug: string;
  year: number | null;
  editions: {
    id: string;
    format: EditionFormat;
    label: string | null;
    quotes: { id: string; slug: string; preview: string }[];
  }[];
};

const WORK_PREVIEW_LENGTH = 160;

function workPreview(searchText: string): string {
  const flat = searchText.replace(/\n/g, " ").trim();
  return flat.length <= WORK_PREVIEW_LENGTH ? flat : `${flat.slice(0, WORK_PREVIEW_LENGTH - 1)}…`;
}

export async function getWorkBySlug(db: Database, slug: string): Promise<WorkPage | null> {
  const work = await db.query.works.findFirst({
    where: eq(works.slug, slug),
    with: { editions: { with: { quotes: true } } },
  });
  if (!work) return null;

  return {
    id: work.id,
    type: work.type,
    title: work.title,
    slug: work.slug,
    year: work.year,
    editions: work.editions.map((edition) => ({
      id: edition.id,
      format: edition.format,
      label: edition.label,
      quotes: edition.quotes.map((quote) => ({
        id: quote.id,
        slug: quote.slug,
        preview: workPreview(quote.searchText),
      })),
    })),
  };
}
```

Note: `Database` and `works` are already imported at the top of the file from Task 8 — do not duplicate those imports.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/repositories/works.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify and commit**

```bash
npm run verify
git add -A
git commit -m "feat: add work page read"
```

---

## Task 13: Runtime Neon client & public entrypoint

**Files:**
- Create: `src/db/client.ts`, `src/db/index.ts`

**Interfaces:**
- Consumes: `@neondatabase/serverless`, `drizzle-orm/neon-serverless`, `@/db/schema`, `Database` type.
- Produces:
  - `getDb(): Database` — a lazily-initialized, connection-pooled Neon client (runtime).
  - `@/db` re-exports all of `@/db/schema` plus `getDb` and the `Database` type.

- [ ] **Step 1: Write the runtime client**

`src/db/client.ts`:

```typescript
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { Database } from "@/db/types";
import * as schema from "@/db/schema";

let db: Database | null = null;

export function getDb(): Database {
  if (db) return db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString });
  db = drizzle(pool, { schema });
  return db;
}
```

- [ ] **Step 2: Write the public entrypoint**

`src/db/index.ts`:

```typescript
export * from "@/db/schema";
export { getDb } from "@/db/client";
export type { Database } from "@/db/types";
```

- [ ] **Step 3: Verify types and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed. (`getDb` is exercised at deploy time with a real `DATABASE_URL`; there is no unit test for it because it opens a live connection.)

- [ ] **Step 4: Verify and commit**

```bash
npm run verify
git add -A
git commit -m "feat: add runtime Neon client and db entrypoint"
```

---

## Self-Review (completed during authoring)

**Spec coverage:**
- Unified discriminated `works` + optional parent → Task 2 (schema), Task 8 (create).
- Editions as coordinate space → Task 2, Task 8.
- Quotes pin to edition + position → Task 2, Task 9; position validation → Task 5.
- Ordered lines with types + unique ordinal → Task 2, Task 9.
- Line-level attribution, speaker (≤1/line via partial unique index) + subject (0..N) with optional half-open spans → Task 2, Task 6 (span validation), Task 9.
- Global canonical characters → Task 2, Task 8.
- Generic polymorphic `external_references` → Task 2 (schema). *Note: no dedicated write/read repository is in scope for this plan (no priority read path consumes it directly); it is created with the schema and will be populated by the ingest plan. Flagged intentionally, not a gap.*
- FTS via generated tsvector + GIN, `search_text` maintained on write → Task 2, Task 4, Task 9, Task 10.
- Read paths: search (Task 10), character (Task 11), work (Task 12), quote detail (Task 9).
- Slug conventions → Task 3, Task 7.
- Testing (unit for pure logic, integration on real Postgres via PGlite) → Tasks 3–12.
- Serverless Neon client with pooled connection → Task 13.

**Placeholder scan:** none — every code and test step contains complete code.

**Type consistency:** `Database`, `Position`/`ValidationResult`, `validateSpan`, `validatePosition`, `buildSearchText`, `quoteSlugBase`, `ensureUniqueSlug`, `create*`/`get*BySlug` signatures are consistent across the tasks that define and consume them. Enum TS types (`WorkType`, `EditionFormat`, `LineType`, `AttributionRole`) are defined in Task 2 and reused verbatim.

**Deferred (per spec non-goals):** People/portrayal, non-character subjects, `ADDRESSEE`/`MENTIONED` split, submissions/auth/moderation, admin UI, pgvector — none appear in this plan.
