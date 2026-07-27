"use client";

import { useState, useTransition } from "react";
import type { EditionFormat, LineType, WorkType } from "@/db/schema";
import { createQuoteAction } from "../../actions";
import type { AuthorQuoteInput, CharacterRef } from "@/repositories/quote-authoring";
import { CharacterCombobox, SubjectsField, type CharacterOption } from "../CharacterCombobox";
import { EditionCombobox } from "../EditionCombobox";

const LINE_TYPES: { value: LineType; label: string }[] = [
  { value: "DIALOG", label: "Dialog" },
  { value: "ON_SCREEN_TEXT", label: "On-screen text" },
  { value: "STAGE_DIRECTION", label: "Stage direction" },
  { value: "PROSE", label: "Prose" },
];

const WORK_TYPES: { value: WorkType; label: string }[] = [
  { value: "MOVIE", label: "Film" },
  { value: "TV_SERIES", label: "TV series" },
  { value: "TV_EPISODE", label: "TV episode" },
  { value: "BOOK", label: "Book" },
];

const EDITION_FORMATS: { value: EditionFormat; label: string }[] = [
  { value: "THEATRICAL", label: "Theatrical" },
  { value: "DIRECTORS_CUT", label: "Director's Cut" },
  { value: "EXTENDED", label: "Extended" },
  { value: "REMASTER", label: "Remaster" },
  { value: "TV_BROADCAST", label: "TV Broadcast" },
  { value: "HARDCOVER", label: "Hardcover" },
  { value: "PAPERBACK", label: "Paperback" },
  { value: "EBOOK", label: "Ebook" },
  { value: "AUDIOBOOK", label: "Audiobook" },
  { value: "OTHER", label: "Other" },
];

type LineState = { type: LineType; content: string; speaker: CharacterRef | null; subjects: CharacterRef[] };

const emptyLine: LineState = { type: "DIALOG", content: "", speaker: null, subjects: [] };

type Props = {
  editions: { id: string; label: string }[];
  characters: CharacterOption[];
};

export function QuoteForm({ editions, characters }: Props) {
  const [editionMode, setEditionMode] = useState<"existing" | "new">(editions.length > 0 ? "existing" : "new");
  const [editionId, setEditionId] = useState("");
  const [newWorkType, setNewWorkType] = useState<WorkType>("MOVIE");
  const [newTitle, setNewTitle] = useState("");
  const [newYear, setNewYear] = useState("");
  const [newFormat, setNewFormat] = useState<EditionFormat>("THEATRICAL");
  const [lines, setLines] = useState<LineState[]>([{ ...emptyLine }]);
  const [position, setPosition] = useState<NonNullable<AuthorQuoteInput["position"]>>({
    start: "",
    end: "",
    page: "",
    chapter: "",
    percent: "",
    note: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateLine(index: number, patch: Partial<LineState>) {
    setLines((current) => current.map((line, idx) => (idx === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((current) => [...current, { ...emptyLine }]);
  }

  function removeLine(index: number) {
    setLines((current) => (current.length > 1 ? current.filter((_, idx) => idx !== index) : current));
  }

  function submit() {
    setError(null);

    const payload: AuthorQuoteInput = {
      edition:
        editionMode === "existing"
          ? { mode: "existing", id: editionId }
          : { mode: "new", workType: newWorkType, title: newTitle, year: newYear, format: newFormat },
      lines: lines.map((line) => ({
        type: line.type,
        content: line.content,
        speaker: line.speaker ?? undefined,
        subjects: line.subjects,
      })),
      position,
    };

    startTransition(async () => {
      const result = await createQuoteAction(payload);
      // On success the action redirects; only an error comes back.
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form
      className="admin-form"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <fieldset className="admin-form__group">
        <legend className="section-label">Source</legend>

        {editions.length > 0 && (
          <div className="admin-form__modes" role="radiogroup" aria-label="Edition source">
            <label className="admin-form__radio">
              <input
                type="radio"
                name="edition-mode"
                checked={editionMode === "existing"}
                onChange={() => setEditionMode("existing")}
              />
              Existing edition
            </label>
            <label className="admin-form__radio">
              <input
                type="radio"
                name="edition-mode"
                checked={editionMode === "new"}
                onChange={() => setEditionMode("new")}
              />
              New work
            </label>
          </div>
        )}

        {editionMode === "existing" ? (
          <div className="admin-form__field">
            <span className="admin-form__label">Edition</span>
            <EditionCombobox
              options={editions}
              value={editionId}
              onChange={setEditionId}
              label="Edition"
              placeholder="Search by title, year, or format…"
            />
          </div>
        ) : (
          <div className="admin-form__row">
            <label className="admin-form__field">
              <span className="admin-form__label">Type</span>
              <select
                className="admin-form__control"
                value={newWorkType}
                onChange={(event) => setNewWorkType(event.target.value as WorkType)}
              >
                {WORK_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-form__field admin-form__field--grow">
              <span className="admin-form__label">Title</span>
              <input
                className="admin-form__control"
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="e.g. The Empire Strikes Back"
              />
            </label>
            <label className="admin-form__field admin-form__field--narrow">
              <span className="admin-form__label">Year</span>
              <input
                className="admin-form__control"
                inputMode="numeric"
                value={newYear}
                onChange={(event) => setNewYear(event.target.value)}
                placeholder="1980"
              />
            </label>
            <label className="admin-form__field">
              <span className="admin-form__label">Format</span>
              <select
                className="admin-form__control"
                value={newFormat}
                onChange={(event) => setNewFormat(event.target.value as EditionFormat)}
              >
                {EDITION_FORMATS.map((format) => (
                  <option key={format.value} value={format.value}>
                    {format.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </fieldset>

      <fieldset className="admin-form__group">
        <legend className="section-label">Lines</legend>
        {lines.map((line, index) => (
          <div key={index} className="admin-line">
            <div className="admin-line__head">
              <span className="admin-line__num tnum">{index + 1}</span>
              <select
                className="admin-form__control admin-line__type"
                aria-label={`Line ${index + 1} type`}
                value={line.type}
                onChange={(event) => updateLine(index, { type: event.target.value as LineType })}
              >
                {LINE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              {lines.length > 1 && (
                <button
                  type="button"
                  className="admin-line__remove"
                  onClick={() => removeLine(index)}
                  aria-label={`Remove line ${index + 1}`}
                >
                  Remove
                </button>
              )}
            </div>
            <textarea
              className="admin-form__control admin-line__content"
              aria-label={`Line ${index + 1} text`}
              rows={2}
              value={line.content}
              onChange={(event) => updateLine(index, { content: event.target.value })}
              placeholder="The line as spoken or written…"
            />
            <div className="admin-line__attrs">
              <div className="admin-form__field admin-form__field--grow">
                <span className="admin-form__label">Speaker</span>
                <CharacterCombobox
                  options={characters}
                  value={line.speaker}
                  onChange={(ref) => updateLine(index, { speaker: ref })}
                  label={`Line ${index + 1} speaker`}
                  placeholder="Character name"
                />
              </div>
              <div className="admin-form__field admin-form__field--grow">
                <span className="admin-form__label">About (subjects)</span>
                <SubjectsField
                  options={characters}
                  value={line.subjects}
                  onChange={(refs) => updateLine(index, { subjects: refs })}
                  label={`Line ${index + 1} subject`}
                />
              </div>
            </div>
          </div>
        ))}
        <button type="button" className="btn-secondary" onClick={addLine}>
          + Add line
        </button>
      </fieldset>

      <details className="admin-form__group admin-form__details">
        <summary className="section-label">Position (optional)</summary>
        <div className="admin-form__row">
          <label className="admin-form__field">
            <span className="admin-form__label">Start</span>
            <input
              className="admin-form__control"
              value={position.start}
              onChange={(event) => setPosition({ ...position, start: event.target.value })}
              placeholder="1:23:45"
            />
          </label>
          <label className="admin-form__field">
            <span className="admin-form__label">End</span>
            <input
              className="admin-form__control"
              value={position.end}
              onChange={(event) => setPosition({ ...position, end: event.target.value })}
              placeholder="1:24:10"
            />
          </label>
          <label className="admin-form__field admin-form__field--narrow">
            <span className="admin-form__label">Page</span>
            <input
              className="admin-form__control"
              inputMode="numeric"
              value={position.page}
              onChange={(event) => setPosition({ ...position, page: event.target.value })}
            />
          </label>
          <label className="admin-form__field admin-form__field--narrow">
            <span className="admin-form__label">Chapter</span>
            <input
              className="admin-form__control"
              value={position.chapter}
              onChange={(event) => setPosition({ ...position, chapter: event.target.value })}
            />
          </label>
          <label className="admin-form__field admin-form__field--narrow">
            <span className="admin-form__label">Percent</span>
            <input
              className="admin-form__control"
              inputMode="decimal"
              value={position.percent}
              onChange={(event) => setPosition({ ...position, percent: event.target.value })}
            />
          </label>
        </div>
        <label className="admin-form__field">
          <span className="admin-form__label">Note</span>
          <input
            className="admin-form__control"
            value={position.note}
            onChange={(event) => setPosition({ ...position, note: event.target.value })}
            placeholder="e.g. epigraph, mid-credits"
          />
        </label>
      </details>

      {error && (
        <p className="admin-form__error" role="alert">
          {error}
        </p>
      )}

      <div className="admin-form__actions">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save quote"}
        </button>
      </div>
    </form>
  );
}
