import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { listEditionsForAdmin } from "@/repositories/editions";
import { listCharacters } from "@/repositories/characters";
import { editionFormatLabel } from "@/lib/format";
import { QuoteForm } from "./QuoteForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Add quote" };

export default async function NewQuotePage() {
  const db = getDb();
  const [editions, characters] = await Promise.all([listEditionsForAdmin(db), listCharacters(db)]);

  const editionOptions = editions.map((edition) => ({
    id: edition.id,
    label: `${edition.workTitle}${edition.workYear ? ` (${edition.workYear})` : ""} — ${editionFormatLabel(edition.format)}${
      edition.label ? ` · ${edition.label}` : ""
    }`,
  }));

  // Character names aren't unique, so de-duplicate for the autocomplete datalist.
  const characterNames = [...new Set(characters.map((character) => character.name))];

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Add a quote</h1>
        <p className="page-subtitle">Compose the lines and attach the quote to an edition.</p>
      </div>
      <QuoteForm editions={editionOptions} characterNames={characterNames} />
    </>
  );
}
