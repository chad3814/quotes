"use client";

import { useState, useTransition } from "react";
import type { LineType } from "@/db/schema";
import type { AuthorPositionInput, CharacterRef } from "@/repositories/quote-authoring";
import { updateQuoteAction } from "../../../actions";
import { CharacterCombobox, SubjectsField, type CharacterOption } from "../../CharacterCombobox";

const LINE_TYPES: { value: LineType; label: string }[] = [
  { value: "DIALOG", label: "Dialog" },
  { value: "ON_SCREEN_TEXT", label: "On-screen text" },
  { value: "STAGE_DIRECTION", label: "Stage direction" },
  { value: "PROSE", label: "Prose" },
];

export type LineState = { type: LineType; content: string; speaker: CharacterRef | null; subjects: CharacterRef[] };

type Props = {
  id: string;
  sourceLabel: string;
  characters: CharacterOption[];
  initialLines: LineState[];
  initialPosition: AuthorPositionInput;
};

const emptyLine: LineState = { type: "DIALOG", content: "", speaker: null, subjects: [] };

export function QuoteEditForm({ id, sourceLabel, characters, initialLines, initialPosition }: Props) {
  const [lines, setLines] = useState<LineState[]>(initialLines.length > 0 ? initialLines : [{ ...emptyLine }]);
  const [position, setPosition] = useState<AuthorPositionInput>(initialPosition);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function updateLine(index: number, patch: Partial<LineState>) {
    setLines((current) => current.map((line, idx) => (idx === index ? { ...line, ...patch } : line)));
    setSaved(false);
  }

  function addLine() {
    setLines((current) => [...current, { ...emptyLine }]);
  }

  function removeLine(index: number) {
    setLines((current) => (current.length > 1 ? current.filter((_, idx) => idx !== index) : current));
  }

  function submit() {
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await updateQuoteAction(id, {
        lines: lines.map((line) => ({
          type: line.type,
          content: line.content,
          speaker: line.speaker ?? undefined,
          subjects: line.subjects,
        })),
        position,
      });
      if (result.error) setError(result.error);
      else setSaved(true);
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
      <p className="admin-form__hint">Editing a quote from {sourceLabel}. The source work can’t be changed here.</p>

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
              value={position.start ?? ""}
              onChange={(event) => setPosition({ ...position, start: event.target.value })}
              placeholder="1:23:45"
            />
          </label>
          <label className="admin-form__field">
            <span className="admin-form__label">End</span>
            <input
              className="admin-form__control"
              value={position.end ?? ""}
              onChange={(event) => setPosition({ ...position, end: event.target.value })}
              placeholder="1:24:10"
            />
          </label>
          <label className="admin-form__field admin-form__field--narrow">
            <span className="admin-form__label">Page</span>
            <input
              className="admin-form__control"
              inputMode="numeric"
              value={position.page ?? ""}
              onChange={(event) => setPosition({ ...position, page: event.target.value })}
            />
          </label>
          <label className="admin-form__field admin-form__field--narrow">
            <span className="admin-form__label">Chapter</span>
            <input
              className="admin-form__control"
              value={position.chapter ?? ""}
              onChange={(event) => setPosition({ ...position, chapter: event.target.value })}
            />
          </label>
          <label className="admin-form__field admin-form__field--narrow">
            <span className="admin-form__label">Percent</span>
            <input
              className="admin-form__control"
              inputMode="decimal"
              value={position.percent ?? ""}
              onChange={(event) => setPosition({ ...position, percent: event.target.value })}
            />
          </label>
        </div>
        <label className="admin-form__field">
          <span className="admin-form__label">Note</span>
          <input
            className="admin-form__control"
            value={position.note ?? ""}
            onChange={(event) => setPosition({ ...position, note: event.target.value })}
          />
        </label>
      </details>

      {error && (
        <p className="admin-form__error" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="admin-form__ok" role="status">
          Saved.
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
