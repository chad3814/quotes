"use client";

import { useMemo, useRef, useState } from "react";
import type { CharacterRef } from "@/repositories/quote-authoring";

export type CharacterOption = { id: string; name: string; quoteCount: number };

type ComboItem =
  | { kind: "option"; option: CharacterOption }
  | { kind: "create"; name: string };

type Props = {
  options: CharacterOption[];
  /** Current selection (controlled). Omit for a transient "adder" that clears after each pick. */
  value?: CharacterRef | null;
  /** Fires on every change including keystrokes — use to keep a single-field parent in sync. */
  onChange?: (ref: CharacterRef | null) => void;
  /** Fires only when the user finalizes a choice (select / Enter / blur) — use for an adder. */
  onCommit?: (ref: CharacterRef | null) => void;
  /** Commit the typed text on blur (default true). An adder passes false so it only commits explicitly. */
  commitOnBlur?: boolean;
  /** Clear the input after a commit (used by the adder). */
  clearOnCommit?: boolean;
  label: string;
  placeholder?: string;
};

const MAX_RESULTS = 8;

/**
 * A character picker: type to filter existing characters and pick one (binding
 * its id so the save can't create a duplicate), or type a new name to create a
 * character. Selecting an existing character is what prevents the casing/variant
 * duplicates the old free-text datalist allowed.
 */
export function CharacterCombobox({
  options,
  value,
  onChange,
  onCommit,
  commitOnBlur = true,
  clearOnCommit = false,
  label,
  placeholder,
}: Props) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const bound = value?.id != null;
  const q = query.trim().toLowerCase();

  const items = useMemo<ComboItem[]>(() => {
    const matches = (q === "" ? options : options.filter((o) => o.name.toLowerCase().includes(q)))
      .slice()
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
        const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return a.name.localeCompare(b.name);
      })
      .slice(0, MAX_RESULTS)
      .map((option): ComboItem => ({ kind: "option", option }));

    const exact = q !== "" && options.some((o) => o.name.toLowerCase() === q);
    if (q !== "" && !exact) matches.push({ kind: "create", name: query.trim() });
    return matches;
  }, [options, q, query]);

  function apply(ref: CharacterRef | null) {
    setQuery(clearOnCommit ? "" : ref?.name ?? "");
    setOpen(false);
    setActive(0);
    onChange?.(ref);
    onCommit?.(ref);
  }

  function commitItem(item: ComboItem) {
    if (item.kind === "option") apply({ id: item.option.id, name: item.option.name });
    else apply({ name: item.name });
  }

  function handleType(text: string) {
    setQuery(text);
    setOpen(true);
    setActive(0);
    // Typing breaks any id binding — it's a new/edited name until re-selected.
    onChange?.(text.trim() ? { name: text.trim() } : null);
  }

  function handleBlur() {
    setOpen(false);
    if (!commitOnBlur) return;
    const name = query.trim();
    if (!name) {
      apply(null);
      return;
    }
    const match = options.find((o) => o.name.toLowerCase() === name.toLowerCase());
    apply(match ? { id: match.id, name: match.name } : { name });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      if (open && items[active]) {
        event.preventDefault();
        commitItem(items[active]);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="admin-combobox">
      <input
        ref={inputRef}
        className={`admin-form__control admin-combobox__input${bound ? " admin-combobox__input--bound" : ""}`}
        role="combobox"
        aria-expanded={open}
        aria-label={label}
        autoComplete="off"
        value={query}
        placeholder={placeholder}
        onChange={(event) => handleType(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      {bound && (
        <span className="admin-combobox__badge" title="Linked to an existing character" aria-hidden>
          ✓
        </span>
      )}
      {open && items.length > 0 && (
        <ul className="admin-combobox__list" role="listbox">
          {items.map((item, index) => (
            <li
              key={item.kind === "option" ? item.option.id : `create-${item.name}`}
              role="option"
              aria-selected={index === active}
              className={`admin-combobox__item${index === active ? " admin-combobox__item--active" : ""}`}
              onMouseDown={(event) => {
                event.preventDefault();
                commitItem(item);
              }}
              onMouseEnter={() => setActive(index)}
            >
              {item.kind === "option" ? (
                <>
                  <span className="admin-combobox__name">{item.option.name}</span>
                  <span className="admin-combobox__hint tnum">
                    {item.option.quoteCount} {item.option.quoteCount === 1 ? "quote" : "quotes"}
                  </span>
                </>
              ) : (
                <span className="admin-combobox__create">
                  Create “{item.name}”
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type SubjectsFieldProps = {
  options: CharacterOption[];
  value: CharacterRef[];
  onChange: (refs: CharacterRef[]) => void;
  label: string;
};

/**
 * Multi-value character field for a line's subjects: selected characters show as
 * removable chips, and an adder combobox appends more (each bound to an id when
 * an existing character is picked).
 */
export function SubjectsField({ options, value, onChange, label }: SubjectsFieldProps) {
  const [adderKey, setAdderKey] = useState(0);

  function addSubject(ref: CharacterRef | null) {
    if (!ref) return;
    const exists = value.some((existing) =>
      ref.id ? existing.id === ref.id : !existing.id && existing.name.toLowerCase() === ref.name.toLowerCase(),
    );
    if (!exists) onChange([...value, ref]);
    setAdderKey((k) => k + 1); // reset the adder input
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="admin-subjects">
      {value.length > 0 && (
        <ul className="admin-subjects__chips">
          {value.map((ref, index) => (
            <li key={ref.id ?? `new-${ref.name}-${index}`} className="admin-subjects__chip">
              <span>{ref.name}</span>
              <button
                type="button"
                className="admin-subjects__remove"
                aria-label={`Remove ${ref.name}`}
                onClick={() => removeAt(index)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <CharacterCombobox
        key={adderKey}
        options={options}
        onCommit={addSubject}
        commitOnBlur={false}
        clearOnCommit
        label={label}
        placeholder="Add a character…"
      />
    </div>
  );
}
