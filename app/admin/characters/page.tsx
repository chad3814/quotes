import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { listCharacters } from "@/repositories/characters";
import { CharacterAdminList } from "./CharacterAdminList";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Characters" };

export default async function AdminCharactersPage() {
  const db = getDb();
  // A high limit so the admin list isn't silently truncated to the default 500.
  const characters = await listCharacters(db, { limit: 10_000 });

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Characters</h1>
      </div>
      <CharacterAdminList characters={characters} />
    </>
  );
}
