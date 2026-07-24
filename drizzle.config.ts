import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit (unlike `next`) does not auto-load env files. Load the target
// env file so `db:generate` / `db:migrate` / `db:push` pick up the connection
// string. Override with ENV_FILE to target another database, e.g.
// `ENV_FILE=.env.production.local npm run db:migrate`. On Vercel/CI the file is
// absent and env comes from the platform, so this is a no-op there.
config({ path: process.env.ENV_FILE ?? ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Migrations run over Neon's direct/unpooled connection — the pooled
  // (PgBouncer) endpoint runs in transaction mode and can break multi-statement
  // DDL. Falls back to DATABASE_URL when an unpooled URL isn't configured.
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
});
