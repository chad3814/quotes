import { config } from "dotenv";
import { parseInput } from "@/ingest/parse-input";
import { createTmdbClient } from "@/ingest/tmdb/client";
import { createIngestDb } from "@/ingest/db";
import { ingestTitle } from "@/ingest/ingest-title";

config({ path: process.env.ENV_FILE ?? ".env.local" });

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg) throw new Error("usage: npm run ingest -- <tmdb-url-or-movie/ID-or-tv/ID>");

  const input = parseInput(arg);
  const tmdb = createTmdbClient();
  const { db, close } = createIngestDb();
  try {
    const summary = await ingestTitle(db, tmdb, input);
    if (summary.type === "movie") {
      console.log(`Ingested movie ${input.id} (${summary.workCreated ? "created" : "updated"}): work ${summary.workId}`);
    } else {
      console.log(
        `Ingested series ${input.id} (${summary.workCreated ? "created" : "updated"}): work ${summary.workId}, ` +
          `${summary.episodesCreated} episodes created, ${summary.episodesUpdated} updated`,
      );
    }
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
