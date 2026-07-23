import type { ValidationResult } from "@/lib/position";

export function validateSpan(
  content: string,
  start: number | null | undefined,
  end: number | null | undefined,
): ValidationResult {
  const hasStart = start != null;
  const hasEnd = end != null;
  if (!hasStart && !hasEnd) return { ok: true };
  if (hasStart !== hasEnd) return { ok: false, error: "span requires both start and end" };
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    return { ok: false, error: "span offsets must be integers" };
  }
  if (start! < 0 || end! > content.length) return { ok: false, error: "span is out of bounds" };
  if (start! >= end!) return { ok: false, error: "span start must be less than end" };
  return { ok: true };
}
