import type { Database } from "@/db/types";
import type { EditionFormat, LineType, WorkType } from "@/db/schema";
import { parseTimecode } from "@/lib/format";
import type { Position } from "@/lib/position";
import { createQuote, updateQuote, type CreateAttributionInput, type CreateLineInput } from "@/repositories/quotes";
import { createWork } from "@/repositories/works";
import { createEdition } from "@/repositories/editions";
import { findOrCreateCharacter } from "@/repositories/characters";

/**
 * A speaker/subject reference. When `id` is present the exact existing character
 * is used (picked from the combobox) — no name matching, so it can't create a
 * duplicate. When only `name` is given (a newly-typed character) it's resolved
 * case-insensitively, creating one if none matches. A bare string is shorthand
 * for `{ name }`, kept so programmatic callers can attribute by name.
 */
export type CharacterRef = { id?: string; name: string };
export type CharacterInput = string | CharacterRef;

export type AuthorLineInput = {
  type: LineType;
  content: string;
  /** Speaker: an existing character (id) or a new one (name). */
  speaker?: CharacterInput;
  /** Subjects: existing characters (id) and/or new ones (name). */
  subjects?: CharacterInput[];
};

export type AuthorEditionInput =
  | { mode: "existing"; id: string }
  | { mode: "new"; workType: WorkType; title: string; year?: string; format: EditionFormat };

export type AuthorPositionInput = {
  start?: string;
  end?: string;
  page?: string;
  chapter?: string;
  percent?: string;
  note?: string;
};

export type AuthorQuoteInput = {
  edition: AuthorEditionInput;
  lines: AuthorLineInput[];
  position?: AuthorPositionInput;
};

function parseOptionalInt(value: string | undefined, label: string): number | undefined {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed)) throw new Error(`${label} must be a whole number.`);
  return parsed;
}

function parseOptionalNumber(value: string | undefined, label: string): number | undefined {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) throw new Error(`${label} must be a number.`);
  return parsed;
}

function buildPosition(position: AuthorPositionInput): Position {
  return {
    startMs: parseTimecode(position.start ?? "") ?? undefined,
    endMs: parseTimecode(position.end ?? "") ?? undefined,
    page: parseOptionalInt(position.page, "Page"),
    chapter: (position.chapter ?? "").trim() || undefined,
    percent: parseOptionalNumber(position.percent, "Percent"),
    locationNote: (position.note ?? "").trim() || undefined,
  };
}

async function resolveEditionId(db: Database, edition: AuthorEditionInput): Promise<string> {
  if (edition.mode === "existing") return edition.id;
  const work = await createWork(db, {
    type: edition.workType,
    title: edition.title.trim(),
    year: parseOptionalInt(edition.year, "Year"),
  });
  const created = await createEdition(db, { workId: work.id, format: edition.format });
  return created.id;
}

/**
 * Resolves a character reference to an id. An `id` (an existing character picked
 * from the list) is used as-is; otherwise the name is resolved/created. Returns
 * null when there's nothing to attribute (a blank name and no id).
 */
async function resolveCharacterId(db: Database, input: CharacterInput): Promise<string | null> {
  const ref: CharacterRef = typeof input === "string" ? { name: input } : input;
  if (ref.id) return ref.id;
  const name = (ref.name ?? "").trim();
  if (!name) return null;
  const character = await findOrCreateCharacter(db, name);
  return character.id;
}

async function buildLines(db: Database, lines: AuthorLineInput[]): Promise<CreateLineInput[]> {
  const built: CreateLineInput[] = [];
  for (const line of lines) {
    const attributions: CreateAttributionInput[] = [];
    if (line.speaker != null) {
      const speakerId = await resolveCharacterId(db, line.speaker);
      if (speakerId) attributions.push({ characterId: speakerId, role: "SPEAKER" });
    }
    // De-duplicate subjects so the same character can't be attributed twice.
    const seenSubjects = new Set<string>();
    for (const subject of line.subjects ?? []) {
      const subjectId = await resolveCharacterId(db, subject);
      if (!subjectId || seenSubjects.has(subjectId)) continue;
      seenSubjects.add(subjectId);
      attributions.push({ characterId: subjectId, role: "SUBJECT" });
    }
    built.push({ type: line.type, content: line.content, attributions });
  }
  return built;
}

/**
 * Assembles a quote from admin-form input: resolves the target edition (existing
 * or a newly-created work+edition), resolves speaker/subject characters by name
 * (creating any that don't exist), maps the position fields, and creates the
 * quote. Throws Error with a user-facing message on invalid input.
 */
export async function authorQuote(db: Database, input: AuthorQuoteInput): Promise<{ id: string; slug: string }> {
  const lines = input.lines
    .map((line) => ({ ...line, content: line.content.trim() }))
    .filter((line) => line.content.length > 0);
  if (lines.length === 0) throw new Error("Add at least one line with some text.");

  if (input.edition.mode === "existing" && !input.edition.id) {
    throw new Error("Choose an edition for the quote.");
  }
  if (input.edition.mode === "new" && !input.edition.title.trim()) {
    throw new Error("Enter a title for the new work.");
  }

  // Atomic: if quote creation fails (e.g. an invalid position), any work/edition/
  // characters created for a "new work" submission roll back too — no orphans.
  return db.transaction(async (tx) => {
    const editionId = await resolveEditionId(tx, input.edition);
    const builtLines = await buildLines(tx, lines);
    const position = buildPosition(input.position ?? {});
    return createQuote(tx, { editionId, lines: builtLines, position });
  });
}

export type EditQuoteInput = {
  lines: AuthorLineInput[];
  position?: AuthorPositionInput;
};

/**
 * Applies admin-form edits to an existing quote: re-resolves speaker/subject
 * characters by name (creating any new ones), rebuilds the position, and replaces
 * the quote's lines. The quote's edition/source and slug are left unchanged.
 * Throws Error with a user-facing message on invalid input.
 */
export async function editQuote(db: Database, id: string, input: EditQuoteInput): Promise<{ id: string; slug: string }> {
  const lines = input.lines
    .map((line) => ({ ...line, content: line.content.trim() }))
    .filter((line) => line.content.length > 0);
  if (lines.length === 0) throw new Error("Add at least one line with some text.");

  return db.transaction(async (tx) => {
    const builtLines = await buildLines(tx, lines);
    const position = buildPosition(input.position ?? {});
    return updateQuote(tx, id, { lines: builtLines, position });
  });
}
