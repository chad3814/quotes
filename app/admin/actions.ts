"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { authorQuote, type AuthorQuoteInput } from "@/repositories/quote-authoring";

export async function createQuoteAction(payload: AuthorQuoteInput): Promise<{ error: string }> {
  const session = await auth();
  if (!isAdmin(session?.user?.githubId)) {
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
