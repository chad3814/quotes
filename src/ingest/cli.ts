import { config } from "dotenv";
import { parseInput } from "@/ingest/parse-input";
import { createTmdbClient } from "@/ingest/tmdb/client";
import { createIbdbClient } from "@/ingest/ibdb/client";
import { createIngestDb } from "@/ingest/db";
import { ingestTitle } from "@/ingest/ingest-title";
import { ingestBook } from "@/ingest/ingest-book";

config({ path: process.env.ENV_FILE ?? ".env.local" });

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg) {
    throw new Error("usage: npm run ingest -- <movie/ID | tv/ID | isbn/ISBN | book/ID | url>");
  }

  const input = parseInput(arg);
  const { db, close } = createIngestDb();
  try {
    if (input.source === "tmdb") {
      const summary = await ingestTitle(db, createTmdbClient(), input);
      if (summary.type === "movie") {
        console.log(`Ingested movie ${input.id} (${summary.workCreated ? "created" : "updated"}): work ${summary.workId}`);
      } else {
        console.log(
          `Ingested series ${input.id} (${summary.workCreated ? "created" : "updated"}): work ${summary.workId}, ` +
            `${summary.episodesCreated} episodes created, ${summary.episodesUpdated} updated`,
        );
      }
    } else {
      const summary = await ingestBook(db, createIbdbClient(), input);
      console.log(
        `Ingested book ${input.kind}/${input.value} (${summary.workCreated ? "created" : "updated"}): ` +
          `work ${summary.workId}, ${summary.editionsCreated} editions created, ${summary.editionsExisting} existing`,
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
