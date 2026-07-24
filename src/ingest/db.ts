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
