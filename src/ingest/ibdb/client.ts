import type { IbdbBook, IbdbBookResponse, IbdbClient } from "@/ingest/ibdb/types";

export type IbdbClientOptions = {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  maxRetries?: number;
  retryBaseMs?: number;
};

export class IbdbError extends Error {
  readonly status: number;
  constructor(status: number, path: string) {
    super(`IBDB request failed (${status}) for ${path}`);
    this.name = "IbdbError";
    this.status = status;
  }
}

const DEFAULT_BASE = "https://ibdb.dev";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createIbdbClient(options: IbdbClientOptions = {}): IbdbClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? DEFAULT_BASE;
  const maxRetries = options.maxRetries ?? 3;
  const retryBaseMs = options.retryBaseMs ?? 500;

  async function getBook(path: string): Promise<IbdbBook> {
    for (let attempt = 0; ; attempt += 1) {
      const res = await fetchImpl(`${baseUrl}${path}`, { headers: { accept: "application/json" } });
      if (res.ok) {
        const data = (await res.json()) as IbdbBookResponse;
        if (data.status === "ok") return data.book;
        throw new Error(`IBDB returned an error for ${path}: ${data.message}`);
      }
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        await sleep(retryBaseMs * 2 ** attempt);
        continue;
      }
      throw new IbdbError(res.status, path);
    }
  }

  return {
    getBookByIsbn: (isbn13) => getBook(`/isbn/${encodeURIComponent(isbn13)}.json`),
    getBookById: (id) => getBook(`/book/${encodeURIComponent(id)}.json`),
  };
}
