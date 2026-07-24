import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getQuoteById } from "@/repositories/quotes";
import { listCharacters } from "@/repositories/characters";
import type { AuthorPositionInput } from "@/repositories/quote-authoring";
import { editionFormatLabel, formatTimecode } from "@/lib/format";
import { QuoteEditForm, type LineState } from "./QuoteEditForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit quote" };

type Params = Promise<{ id: string }>;

export default async function EditQuotePage({ params }: { params: Params }) {
  const { id } = await params;
  const db = getDb();
  const [quote, characters] = await Promise.all([getQuoteById(db, id), listCharacters(db)]);
  if (!quote) notFound();

  const initialLines: LineState[] = quote.lines.map((line) => ({
    type: line.type,
    content: line.content,
    speaker: line.attributions.find((attr) => attr.role === "SPEAKER")?.characterName ?? "",
    subjects: line.attributions
      .filter((attr) => attr.role === "SUBJECT")
      .map((attr) => attr.characterName)
      .join(", "),
  }));

  const { position } = quote;
  const initialPosition: AuthorPositionInput = {
    start: position.startMs != null ? formatTimecode(position.startMs) : "",
    end: position.endMs != null ? formatTimecode(position.endMs) : "",
    page: position.page != null ? String(position.page) : "",
    chapter: position.chapter ?? "",
    percent: position.percent != null ? String(Number(position.percent)) : "",
    note: position.locationNote ?? "",
  };

  const { work, edition } = quote.source;
  const sourceLabel = `${work.title}${work.year ? ` (${work.year})` : ""} — ${editionFormatLabel(edition.format)}`;
  const characterNames = [...new Set(characters.map((character) => character.name))];

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Edit quote</h1>
        <p className="page-subtitle">
          <a href={`/quotes/${quote.slug}`}>View quote</a>
        </p>
      </div>
      <QuoteEditForm
        id={quote.id}
        sourceLabel={sourceLabel}
        characterNames={characterNames}
        initialLines={initialLines}
        initialPosition={initialPosition}
      />
    </>
  );
}
