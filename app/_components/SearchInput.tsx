"use client";

import { useEffect, useRef } from "react";
import { SearchIcon } from "./icons";

type Props = {
  variant?: "hero" | "compact";
  defaultValue?: string;
  autoFocus?: boolean;
};

/**
 * Search form (GET → /search?q=…). Pressing "/" anywhere focuses it; Escape blurs.
 */
export function SearchInput({ variant = "compact", defaultValue = "", autoFocus = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isHero = variant === "hero";

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const active = document.activeElement as HTMLElement | null;
      const typingElsewhere = active?.tagName === "INPUT" || active?.tagName === "TEXTAREA" || active?.isContentEditable;
      if (event.key === "/" && !typingElsewhere) {
        event.preventDefault();
        inputRef.current?.focus();
      } else if (event.key === "Escape" && active === inputRef.current) {
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <form
      role="search"
      action="/search"
      aria-label={isHero ? "Search quotes" : "Site search"}
      className={`search ${isHero ? "search--hero" : "search--compact"}`}
    >
      <span className="search__icon">
        <SearchIcon />
      </span>
      <input
        ref={inputRef}
        type="search"
        name="q"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        className="search__input"
        placeholder={isHero ? "Search quotes, works, or characters" : "Search quotes"}
        aria-label="Search quotes"
        autoComplete="off"
        spellCheck={false}
      />
      {isHero ? (
        <button type="submit" className="btn-primary">
          Search
        </button>
      ) : (
        <kbd className="search__kbd" aria-hidden="true">
          /
        </kbd>
      )}
    </form>
  );
}
