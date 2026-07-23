import { describe, expect, it } from "vitest";
import { quotePreview } from "@/lib/preview";

describe("quotePreview", () => {
  it("passes short strings through unchanged", () => {
    expect(quotePreview("Use the Force, Luke.")).toBe("Use the Force, Luke.");
  });

  it("flattens newlines to spaces", () => {
    expect(quotePreview("Use the Force,\nLuke.")).toBe("Use the Force, Luke.");
  });

  it("truncates strings longer than 160 chars to 160 chars ending in an ellipsis", () => {
    const long = "a".repeat(200);
    const result = quotePreview(long);
    expect(result).toHaveLength(160);
    expect(result.endsWith("…")).toBe(true);
    expect(result).toBe(`${"a".repeat(159)}…`);
  });
});
