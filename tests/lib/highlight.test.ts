import { describe, expect, it } from "vitest";
import { HL_END, HL_START, renderHeadline } from "@/lib/highlight";

describe("renderHeadline", () => {
  it("converts ts_headline sentinels into <mark>", () => {
    expect(renderHeadline(`Use the ${HL_START}Force${HL_END}, Luke.`)).toBe("Use the <mark>Force</mark>, Luke.");
  });

  it("escapes HTML in the surrounding quote text (XSS defense)", () => {
    const malicious = `before <script>alert(1)</script> ${HL_START}match${HL_END} & <img onerror=x>`;
    const out = renderHeadline(malicious);
    expect(out).toBe(
      "before &lt;script&gt;alert(1)&lt;/script&gt; <mark>match</mark> &amp; &lt;img onerror=x&gt;",
    );
    expect(out).not.toContain("<script>");
    expect(out).not.toContain("<img");
  });

  it("does NOT treat a literal <b> in the quote text as a highlight", () => {
    expect(renderHeadline("a <b>literal</b> tag")).toBe("a &lt;b&gt;literal&lt;/b&gt; tag");
  });

  it("leaves plain text untouched apart from escaping", () => {
    expect(renderHeadline("no matches here")).toBe("no matches here");
  });
});
