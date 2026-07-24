"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "auto";
const OPTIONS: Theme[] = ["light", "dark", "auto"];
const listeners = new Set<() => void>();

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem("theme");
    return stored === "light" || stored === "dark" ? stored : "auto";
  } catch {
    return "auto";
  }
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function applyTheme(next: Theme): void {
  try {
    if (next === "auto") {
      document.documentElement.removeAttribute("data-theme");
      localStorage.removeItem("theme");
    } else {
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    }
  } catch {
    // Ignore storage failures (private mode, etc.) — the DOM change still applies.
  }
  // The `storage` event doesn't fire in the same tab, so notify subscribers directly.
  for (const callback of listeners) callback();
}

export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme>(subscribe, readTheme, () => "auto");

  return (
    <div className="theme-toggle" role="group" aria-label="Theme">
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          className="theme-toggle__btn"
          aria-pressed={theme === option}
          onClick={() => applyTheme(option)}
        >
          {option[0].toUpperCase() + option.slice(1)}
        </button>
      ))}
    </div>
  );
}
