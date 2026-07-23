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
