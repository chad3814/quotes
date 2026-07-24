import type { EditionFormat, WorkType } from "@/db/schema";

const WORK_TYPE_LABELS: Record<WorkType, string> = {
  MOVIE: "Film",
  TV_SERIES: "TV Series",
  TV_EPISODE: "Episode",
  BOOK: "Book",
};

export function workTypeLabel(type: WorkType): string {
  return WORK_TYPE_LABELS[type];
}

const EDITION_FORMAT_LABELS: Record<EditionFormat, string> = {
  THEATRICAL: "Theatrical",
  DIRECTORS_CUT: "Director's Cut",
  EXTENDED: "Extended",
  REMASTER: "Remaster",
  TV_BROADCAST: "TV Broadcast",
  HARDCOVER: "Hardcover",
  PAPERBACK: "Paperback",
  EBOOK: "Ebook",
  AUDIOBOOK: "Audiobook",
  OTHER: "Other",
};

export function editionFormatLabel(format: EditionFormat): string {
  return EDITION_FORMAT_LABELS[format];
}

/** Formats a season/episode pair as SxxExx (e.g. S02E05). */
export function episodeCode(season: number | null, episode: number | null): string | null {
  if (season == null && episode == null) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const s = season == null ? "" : `S${pad(season)}`;
  const e = episode == null ? "" : `E${pad(episode)}`;
  return `${s}${e}`;
}

/** Milliseconds → H:MM:SS (hours dropped when zero). */
export function formatTimecode(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

export type PositionParts = {
  startMs: number | null;
  endMs: number | null;
  chapter: string | null;
  page: number | null;
  percent: string | null;
  locationNote: string | null;
};

/** Human-readable position "chips" for a quote — timecode, chapter, page, percent, note. */
export function formatPosition(position: PositionParts): string[] {
  const chips: string[] = [];
  if (position.startMs != null) {
    const start = formatTimecode(position.startMs);
    chips.push(position.endMs != null ? `${start}–${formatTimecode(position.endMs)}` : start);
  }
  if (position.chapter) chips.push(`ch. ${position.chapter}`);
  if (position.page != null) chips.push(`p. ${position.page}`);
  if (position.percent != null) {
    const value = Number(position.percent);
    chips.push(`${Number.isNaN(value) ? position.percent : value}%`);
  }
  if (position.locationNote) chips.push(position.locationNote);
  return chips;
}

/** "1 quote" / "3 quotes" — small helper used across list headers. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Parses a timecode string into milliseconds. Accepts "h:mm:ss", "m:ss", or a
 * bare integer number of seconds. Returns null for empty or unparseable input.
 */
export function parseTimecode(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;

  const parts = trimmed.split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every((part) => /^\d+$/.test(part))) return null;

  const nums = parts.map(Number);
  const seconds = nums.length === 3 ? nums[0] * 3600 + nums[1] * 60 + nums[2] : nums[0] * 60 + nums[1];
  return seconds * 1000;
}
