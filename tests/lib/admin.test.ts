import { describe, expect, it } from "vitest";
import { isAdmin, parseAdminAccounts } from "@/lib/admin";

describe("parseAdminAccounts", () => {
  it("parses comma-separated ids, trimming blanks and empties", () => {
    expect([...parseAdminAccounts("123, 456 ,,789 ")]).toEqual(["123", "456", "789"]);
  });
  it("handles undefined and empty input", () => {
    expect(parseAdminAccounts(undefined).size).toBe(0);
    expect(parseAdminAccounts("").size).toBe(0);
    expect(parseAdminAccounts("  ,  ").size).toBe(0);
  });
});

describe("isAdmin", () => {
  it("returns true only for ids in the allowlist", () => {
    expect(isAdmin("123", "123,456")).toBe(true);
    expect(isAdmin("456", "123,456")).toBe(true);
    expect(isAdmin("999", "123,456")).toBe(false);
  });
  it("returns false for a missing githubId", () => {
    expect(isAdmin(null, "123")).toBe(false);
    expect(isAdmin(undefined, "123")).toBe(false);
    expect(isAdmin("", "123")).toBe(false);
  });
  it("returns false when the allowlist is empty or unset", () => {
    expect(isAdmin("123", "")).toBe(false);
    expect(isAdmin("123", undefined)).toBe(false);
  });
});
