export type IbdbImage = {
  url: string;
  width?: number;
  height?: number;
};

export type IbdbAuthor = {
  id: string;
  name: string;
};

export type IbdbEdition = {
  id: string;
  isbn13: string;
  /** 'Unknown' | 'Hardcover' | 'Paperback' | 'Ebook' | 'Audiobook' */
  binding: string;
  publicationDate?: string | null;
  publisher?: string | null;
  image?: IbdbImage | null;
};

export type IbdbBook = {
  id: string;
  title: string;
  longTitle?: string | null;
  synopsis?: string | null;
  publicationDate?: string | null;
  publisher?: string | null;
  image?: IbdbImage | null;
  authors: IbdbAuthor[];
  editions: IbdbEdition[];
};

export type IbdbBookResponse = { status: "ok"; book: IbdbBook } | { status: "error"; message: string };

export interface IbdbClient {
  getBookByIsbn(isbn13: string): Promise<IbdbBook>;
  getBookById(id: string): Promise<IbdbBook>;
}
