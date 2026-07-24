import type { WorkType } from "@/db/schema";

/** Payload for creating a work from the admin "add work" form. */
export type CreateWorkPayload =
  | { mode: "tmdb"; tmdbType: "movie" | "tv"; tmdbId: number }
  | { mode: "manual"; type: WorkType; title: string; year: string; originalTitle: string; synopsis: string };

/** Payload for editing a work's metadata fields. */
export type UpdateWorkPayload = {
  title: string;
  originalTitle: string;
  year: string;
  seasonNumber: string;
  episodeNumber: string;
  synopsis: string;
};
