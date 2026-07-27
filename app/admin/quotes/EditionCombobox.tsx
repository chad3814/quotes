"use client";

import { useMemo, useState } from "react";

export type EditionOption = { id: string; label: string };

type Props = {
  options: EditionOption[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  placeholder?: string;
};

const MAX_RESULTS = 12;

/**
 * A searchable single-select for the edition/source of a quote. With 900+ works
 * a native <select> is unusable, so this filters the list as you type and binds
 * the chosen edition's id. Selection is required — there's no "create" row here;
 * the form's "New work" mode handles adding a brand-new source.
 */
export function EditionCombobox({ options, value, onChange, label, placeholder }: Props) {
  const selected = options.find((option) => option.id === value) ?? null;
  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    // Every whitespace-separated term must match, so "office 4" narrows by title
    // and season/year across the label.
    const terms = q.split(/\s+/).filter(Boolean);
    const list =
      terms.length === 0
        ? options
        : options.filter((option) => {
            const haystack = option.label.toLowerCase();
            return terms.every((term) => haystack.includes(term));
          });
    return list.slice(0, MAX_RESULTS);
  }, [options, q]);

  function select(option: EditionOption) {
    onChange(option.id);
    setQuery(option.label);
    setOpen(false);
    setActive(0);
  }

  function handleType(text: string) {
    setQuery(text);
    setOpen(true);
    setActive(0);
    // Typing away from the selected label clears the binding until re-picked.
    if (value) onChange("");
  }

  function handleBlur() {
    setOpen(false);
    // Snap the text back to the selected edition's label (or clear if none).
    setQuery(selected?.label ?? "");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      if (open && matches[active]) {
        event.preventDefault();
        select(matches[active]);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="admin-combobox">
      <input
        className={`admin-form__control admin-combobox__input${value ? " admin-combobox__input--bound" : ""}`}
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
      {value && (
        <span className="admin-combobox__badge" title="An edition is selected" aria-hidden>
          ✓
        </span>
      )}
      {open && matches.length > 0 && (
        <ul className="admin-combobox__list" role="listbox">
          {matches.map((option, index) => (
            <li
              key={option.id}
              role="option"
              aria-selected={index === active}
              className={`admin-combobox__item${index === active ? " admin-combobox__item--active" : ""}`}
              onMouseDown={(event) => {
                event.preventDefault();
                select(option);
              }}
              onMouseEnter={() => setActive(index)}
            >
              <span className="admin-combobox__name">{option.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
