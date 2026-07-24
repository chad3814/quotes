/**
 * Sentinels wrapped around matched terms by `ts_headline` (configured in
 * search.ts via StartSel/StopSel). They are chosen from characters that are NOT
 * altered by HTML-escaping and are astronomically unlikely to occur in quote
 * text, so they cannot collide with literal markup a quote might contain.
 */
export const HL_START = "@@hl@@";
export const HL_END = "@@/hl@@";

const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (char) => ESCAPE_MAP[char]);
}

/**
 * Converts a Postgres `ts_headline` string into HTML that is safe to inject.
 *
 * `ts_headline` wraps the matched terms in our HL_START/HL_END sentinels but
 * leaves the surrounding quote text RAW (it does not HTML-escape it), so the
 * string cannot be trusted as HTML. We escape the entire string first —
 * neutralizing any markup embedded in the quote (including literal `<b>` tags,
 * which are now preserved as text rather than mistaken for highlights) — and
 * only then re-introduce `<mark>` tags where the sentinels were. The result is
 * safe to pass to dangerouslySetInnerHTML.
 */
export function renderHeadline(headline: string): string {
  return escapeHtml(headline).replaceAll(HL_START, "<mark>").replaceAll(HL_END, "</mark>");
}
