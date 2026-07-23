const MAX_SLUG_WORDS = 6;

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function quoteSlugBase(lines: { ordinal: number; content: string }[]): string {
  const first = [...lines].sort((a, b) => a.ordinal - b.ordinal)[0];
  const slug = slugify(first?.content ?? "").split("-").filter(Boolean).slice(0, MAX_SLUG_WORDS).join("-");
  return slug.length > 0 ? slug : "quote";
}
