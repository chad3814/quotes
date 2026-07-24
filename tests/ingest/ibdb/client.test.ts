import { describe, expect, it, vi } from "vitest";
import { createIbdbClient, IbdbError } from "@/ingest/ibdb/client";
import type { IbdbBook } from "@/ingest/ibdb/types";

function jsonResponse<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const BOOK: IbdbBook = {
  id: "b1",
  title: "Dune",
  synopsis: "Spice.",
  publicationDate: "1965-08-01",
  image: { url: "https://images.isbndb.com/covers/x.jpg" },
  authors: [{ id: "a1", name: "Frank Herbert" }],
  editions: [{ id: "e1", isbn13: "9780441172719", binding: "Paperback" }],
};

describe("createIbdbClient", () => {
  it("fetches a book by ISBN from the .json endpoint", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ status: "ok", book: BOOK }));
    const client = createIbdbClient({ fetchImpl });
    const book = await client.getBookByIsbn("9780441172719");
    expect(book.title).toBe("Dune");
    expect(String(fetchImpl.mock.calls[0][0])).toBe("https://ibdb.dev/isbn/9780441172719.json");
  });

  it("fetches a book by id from the .json endpoint", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ status: "ok", book: BOOK }));
    const client = createIbdbClient({ fetchImpl });
    await client.getBookById("b1");
    expect(String(fetchImpl.mock.calls[0][0])).toBe("https://ibdb.dev/book/b1.json");
  });

  it("throws IbdbError on a non-ok HTTP status", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response("", { status: 404 }));
    const client = createIbdbClient({ fetchImpl });
    await expect(client.getBookByIsbn("nope")).rejects.toBeInstanceOf(IbdbError);
  });

  it("throws on a body-level error status", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ status: "error", message: "not found" }));
    const client = createIbdbClient({ fetchImpl });
    await expect(client.getBookById("nope")).rejects.toThrow(/not found/);
  });

  it("retries on HTTP 429 then succeeds", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(jsonResponse({ status: "ok", book: BOOK }));
    const client = createIbdbClient({ fetchImpl, retryBaseMs: 0 });
    const book = await client.getBookByIsbn("x");
    expect(book.title).toBe("Dune");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
