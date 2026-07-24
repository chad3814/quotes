"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { createWork, getWorkById, updateWork, type UpdateWorkFields } from "@/repositories/works";
import { getExternalReference } from "@/repositories/external-references";
import { createTmdbClient } from "@/ingest/tmdb/client";
import { ingestTitle } from "@/ingest/ingest-title";
import { tmdbInputForWork } from "@/lib/tmdb";
import type { CreateWorkPayload, UpdateWorkPayload } from "./types";

async function isRequestAdmin(): Promise<boolean> {
  const session = await auth();
  return isAdmin({ id: session?.user?.githubId, login: session?.user?.githubLogin });
}

/** Parses an optional integer field from form input. "" → null; invalid → throws. */
function parseIntOrNull(value: string, label: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed)) throw new Error(`${label} must be a whole number.`);
  return parsed;
}

export async function createWorkAction(payload: CreateWorkPayload): Promise<{ error: string }> {
  if (!(await isRequestAdmin())) return { error: "You are not authorized to add works." };
  const db = getDb();

  let workId: string;
  try {
    if (payload.mode === "tmdb") {
      const tmdb = createTmdbClient();
      const summary = await ingestTitle(db, tmdb, { type: payload.tmdbType, id: payload.tmdbId });
      workId = summary.workId;
    } else {
      const title = payload.title.trim();
      if (!title) return { error: "Enter a title for the work." };
      const year = parseIntOrNull(payload.year, "Year");
      const created = await createWork(db, {
        type: payload.type,
        title,
        originalTitle: payload.originalTitle.trim() || undefined,
        synopsis: payload.synopsis.trim() || undefined,
        year: year ?? undefined,
      });
      workId = created.id;
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create the work." };
  }

  revalidatePath("/works");
  revalidatePath("/admin/works");
  redirect(`/admin/works/${workId}`);
}

export async function updateWorkAction(id: string, payload: UpdateWorkPayload): Promise<{ error?: string; ok?: boolean }> {
  if (!(await isRequestAdmin())) return { error: "You are not authorized to edit works." };

  const title = payload.title.trim();
  if (!title) return { error: "Title can't be empty." };

  let fields: UpdateWorkFields;
  try {
    fields = {
      title,
      originalTitle: payload.originalTitle.trim() || null,
      synopsis: payload.synopsis.trim() || null,
      year: parseIntOrNull(payload.year, "Year"),
      seasonNumber: parseIntOrNull(payload.seasonNumber, "Season number"),
      episodeNumber: parseIntOrNull(payload.episodeNumber, "Episode number"),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid input." };
  }

  const db = getDb();
  const work = await getWorkById(db, id);
  if (!work) return { error: "Work not found." };

  await updateWork(db, id, fields);

  revalidatePath(`/admin/works/${id}`);
  revalidatePath(`/works/${work.slug}`);
  revalidatePath("/works");
  return { ok: true };
}

export async function resyncWorkAction(id: string): Promise<{ error?: string; message?: string }> {
  if (!(await isRequestAdmin())) return { error: "You are not authorized to re-sync works." };

  const db = getDb();
  const work = await getWorkById(db, id);
  if (!work) return { error: "Work not found." };

  const ref = await getExternalReference(db, "WORK", id, "TMDB");
  if (!ref) return { error: "This work has no TMDb reference to re-sync." };

  const input = tmdbInputForWork(work.type, ref.externalId);
  if (!input) return { error: "Only movies and TV series can be re-synced from TMDb." };

  let message: string;
  try {
    const tmdb = createTmdbClient();
    const summary = await ingestTitle(db, tmdb, input);
    message =
      summary.type === "movie"
        ? "Re-synced from TMDb."
        : `Re-synced from TMDb — ${summary.episodesCreated} episode(s) added, ${summary.episodesUpdated} updated.`;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Re-sync failed." };
  }

  revalidatePath(`/admin/works/${id}`);
  revalidatePath(`/works/${work.slug}`);
  revalidatePath("/works");
  return { message };
}
