"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { authorQuote, editQuote, type AuthorQuoteInput, type EditQuoteInput } from "@/repositories/quote-authoring";

export async function createQuoteAction(payload: AuthorQuoteInput): Promise<{ error: string }> {
  const session = await auth();
  if (!isAdmin({ id: session?.user?.githubId, login: session?.user?.githubLogin })) {
    return { error: "You are not authorized to add quotes." };
  }

  const db = getDb();
  let slug: string;
  try {
    slug = (await authorQuote(db, payload)).slug;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create the quote." };
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/works");
  redirect(`/quotes/${slug}`);
}

export async function updateQuoteAction(id: string, payload: EditQuoteInput): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!isAdmin({ id: session?.user?.githubId, login: session?.user?.githubLogin })) {
    return { error: "You are not authorized to edit quotes." };
  }

  const db = getDb();
  let slug: string;
  try {
    slug = (await editQuote(db, id, payload)).slug;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update the quote." };
  }

  revalidatePath(`/quotes/${slug}`);
  revalidatePath(`/admin/quotes/${id}/edit`);
  revalidatePath("/");
  return { ok: true };
}
