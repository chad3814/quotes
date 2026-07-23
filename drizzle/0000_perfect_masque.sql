CREATE TYPE "public"."attribution_role" AS ENUM('SPEAKER', 'SUBJECT');--> statement-breakpoint
CREATE TYPE "public"."edition_format" AS ENUM('THEATRICAL', 'DIRECTORS_CUT', 'EXTENDED', 'REMASTER', 'TV_BROADCAST', 'HARDCOVER', 'PAPERBACK', 'EBOOK', 'AUDIOBOOK', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('WORK', 'CHARACTER', 'EDITION', 'PERSON');--> statement-breakpoint
CREATE TYPE "public"."line_type" AS ENUM('DIALOG', 'ON_SCREEN_TEXT', 'STAGE_DIRECTION', 'PROSE');--> statement-breakpoint
CREATE TYPE "public"."reference_provider" AS ENUM('TMDB', 'IMDB', 'IBDB', 'WIKIPEDIA', 'WIKIDATA', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."work_type" AS ENUM('MOVIE', 'TV_SERIES', 'TV_EPISODE', 'BOOK');--> statement-breakpoint
CREATE TABLE "attributions" (
	"id" text PRIMARY KEY NOT NULL,
	"line_id" text NOT NULL,
	"character_id" text NOT NULL,
	"role" "attribution_role" NOT NULL,
	"start" integer,
	"end" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "characters_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "editions" (
	"id" text PRIMARY KEY NOT NULL,
	"work_id" text NOT NULL,
	"format" "edition_format" NOT NULL,
	"label" text,
	"language" text,
	"release_date" date,
	"runtime_ms" integer,
	"page_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_references" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"entity_id" text NOT NULL,
	"provider" "reference_provider" NOT NULL,
	"external_id" text NOT NULL,
	"url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lines" (
	"id" text PRIMARY KEY NOT NULL,
	"quote_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"type" "line_type" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" text PRIMARY KEY NOT NULL,
	"edition_id" text NOT NULL,
	"slug" text NOT NULL,
	"start_ms" integer,
	"end_ms" integer,
	"chapter" text,
	"page" integer,
	"percent" numeric(5, 2),
	"location_note" text,
	"search_text" text DEFAULT '' NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce("quotes"."search_text", ''))) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "works" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "work_type" NOT NULL,
	"parent_work_id" text,
	"title" text NOT NULL,
	"original_title" text,
	"slug" text NOT NULL,
	"year" integer,
	"season_number" integer,
	"episode_number" integer,
	"synopsis" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "works_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "attributions" ADD CONSTRAINT "attributions_line_id_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attributions" ADD CONSTRAINT "attributions_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editions" ADD CONSTRAINT "editions_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lines" ADD CONSTRAINT "lines_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_parent_fk" FOREIGN KEY ("parent_work_id") REFERENCES "public"."works"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attributions_line_idx" ON "attributions" USING btree ("line_id");--> statement-breakpoint
CREATE INDEX "attributions_character_role_idx" ON "attributions" USING btree ("character_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "attributions_one_speaker_per_line_uq" ON "attributions" USING btree ("line_id") WHERE "attributions"."role" = 'SPEAKER';--> statement-breakpoint
CREATE INDEX "editions_work_idx" ON "editions" USING btree ("work_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_references_uq" ON "external_references" USING btree ("provider","entity_type","external_id");--> statement-breakpoint
CREATE INDEX "external_references_entity_idx" ON "external_references" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lines_quote_ordinal_uq" ON "lines" USING btree ("quote_id","ordinal");--> statement-breakpoint
CREATE INDEX "quotes_edition_idx" ON "quotes" USING btree ("edition_id");--> statement-breakpoint
CREATE INDEX "quotes_search_idx" ON "quotes" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "works_parent_idx" ON "works" USING btree ("parent_work_id");--> statement-breakpoint
CREATE INDEX "works_type_idx" ON "works" USING btree ("type");