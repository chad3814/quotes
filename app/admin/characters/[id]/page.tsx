import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getCharacterEditById } from "@/repositories/characters";
import { CharacterEditForm } from "./CharacterEditForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit character" };

type Params = Promise<{ id: string }>;

export default async function EditCharacterPage({ params }: { params: Params }) {
  const { id } = await params;
  const db = getDb();
  const character = await getCharacterEditById(db, id);
  if (!character) notFound();

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Edit character</h1>
        <p className="page-subtitle">{character.name}</p>
      </div>
      <CharacterEditForm
        id={character.id}
        slug={character.slug}
        quoteCount={character.quoteCount}
        initial={{ name: character.name, description: character.description ?? "" }}
      />
    </>
  );
}
