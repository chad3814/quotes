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
  it("matches a numeric id in the allowlist", () => {
    expect(isAdmin({ id: "123" }, "123,octocat")).toBe(true);
    expect(isAdmin({ id: "999" }, "123,octocat")).toBe(false);
  });
  it("matches a username case-insensitively", () => {
    expect(isAdmin({ login: "Octocat" }, "123,octocat")).toBe(true);
    expect(isAdmin({ login: "octocat" }, "123,OctoCat")).toBe(true);
    expect(isAdmin({ login: "someone-else" }, "123,octocat")).toBe(false);
  });
  it("matches when either id or login is listed", () => {
    expect(isAdmin({ id: "999", login: "octocat" }, "octocat")).toBe(true);
    expect(isAdmin({ id: "123", login: "nope" }, "123")).toBe(true);
    expect(isAdmin({ id: "999", login: "nobody" }, "123,octocat")).toBe(false);
  });
  it("returns false for a missing identity", () => {
    expect(isAdmin(null, "123")).toBe(false);
    expect(isAdmin(undefined, "123")).toBe(false);
    expect(isAdmin({}, "123")).toBe(false);
    expect(isAdmin({ id: "", login: "" }, "123")).toBe(false);
  });
  it("returns false when the allowlist is empty or unset", () => {
    expect(isAdmin({ id: "123", login: "octocat" }, "")).toBe(false);
    expect(isAdmin({ id: "123", login: "octocat" }, undefined)).toBe(false);
  });
});
