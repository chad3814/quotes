"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import {
  getCharacterEditById,
  updateCharacter,
  deleteCharacter,
  mergeCharacters,
} from "@/repositories/characters";
import type { UpdateCharacterPayload } from "./types";

async function isRequestAdmin(): Promise<boolean> {
  const session = await auth();
  return isAdmin({ id: session?.user?.githubId, login: session?.user?.githubLogin });
}

export async function updateCharacterAction(
  id: string,
  payload: UpdateCharacterPayload,
): Promise<{ error?: string; ok?: boolean }> {
  if (!(await isRequestAdmin())) return { error: "You are not authorized to edit characters." };

  const name = payload.name.trim();
  if (!name) return { error: "Name can't be empty." };

  const db = getDb();
  const character = await getCharacterEditById(db, id);
  if (!character) return { error: "Character not found." };

  await updateCharacter(db, id, { name, description: payload.description.trim() || null });

  revalidatePath("/admin/characters");
  revalidatePath(`/admin/characters/${id}`);
  revalidatePath(`/characters/${character.slug}`);
  revalidatePath("/characters");
  return { ok: true };
}

export async function mergeCharacterAction(sourceId: string, targetId: string): Promise<{ error: string }> {
  if (!(await isRequestAdmin())) return { error: "You are not authorized to merge characters." };
  if (!targetId) return { error: "Choose a character to merge into." };
  if (targetId === sourceId) return { error: "Choose a different character to merge into." };

  const db = getDb();
  const source = await getCharacterEditById(db, sourceId);
  if (!source) return { error: "Character not found." };

  try {
    await mergeCharacters(db, { sourceId, targetId });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not merge the characters." };
  }

  revalidatePath("/admin/characters");
  revalidatePath("/characters");
  revalidatePath(`/characters/${source.slug}`);
  redirect(`/admin/characters/${targetId}`);
}

export async function deleteCharacterAction(id: string): Promise<{ error: string }> {
  if (!(await isRequestAdmin())) return { error: "You are not authorized to delete characters." };

  const db = getDb();
  const character = await getCharacterEditById(db, id);
  if (!character) return { error: "Character not found." };

  await deleteCharacter(db, id);

  revalidatePath("/admin/characters");
  revalidatePath(`/characters/${character.slug}`);
  revalidatePath("/characters");
  redirect("/admin/characters");
}
