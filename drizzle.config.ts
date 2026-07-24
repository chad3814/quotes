import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Migrations run over Neon's direct/unpooled connection — the pooled
  // (PgBouncer) endpoint runs in transaction mode and can break multi-statement
  // DDL. Falls back to DATABASE_URL when an unpooled URL isn't configured.
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
});
