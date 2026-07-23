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
