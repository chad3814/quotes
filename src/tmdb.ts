import 'dot-env';

export type TmdbMovie = {
    adult: boolean;
    backdrop_path: string;
    genre_ids: number[];
    id: number;
    original_language: string;
    original_title: string;
    overview: string;
    popularity: number;
    poster_path: string;
    release_date: string;
    title: string;
    video: boolean;
    vote_average: number;
    vote_count: number;
}

export type TmdbMovieResults = {
    page: number;
    results: TmdbMovie[];
    total_pages: number;
    total_results: number;
}

export type TmdbExternalIds = {
    imdb_id?: string;
    wikidata_id?: string;
    facebook_id?: string;
    instagram_id?: string;
    twitter_id?: string;
};

export enum TmdbGender {
    Unknown = 0,
    Female = 1,
    Male = 2,
    NonBinary = 3,
};

export type TmdbCastCredit = {
    adult: boolean;
    gender: TmdbGender;
    id: number;
    known_for_department: string;
    name: string;
    original_name: string;
    popularity: number;
    profile_path: string;
    cast_id: number;
    character: string;
    credit_id: string;
    order: number;
};

export type TmdbCrewCredit = {
    adult: boolean;
    gender: TmdbGender;
    id: number;
    known_for_department: string;
    name: string;
    original_name: string;
    popularity: number;
    profile_path: string;
    cast_id: number;
    credit_id: string;
    department: string;
    job: string;
};

export type TmdbFullMovieInfo = TmdbMovie & {
    external_ids: TmdbExternalIds;
    credits: {
        cast: TmdbCastCredit[];
        crew: TmdbCrewCredit[];
    };
};

export async function searchTmdb(query: string, page?: number): Promise<TmdbMovieResults> {
    const url = new URL('https://api.themoviedb.org/3/search/movie');
    url.searchParams.set('query', query);
    url.searchParams.set('language', 'en-US');
    if (page) {
        url.searchParams.set('page', page.toString(10));
    }
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${process.env.TMDB_KEY!}`,
      },
    };

    const res = await fetch(url.href, options);
    if (!res.ok) {
        throw new Error(`Failed to search movies ${res.status} - ${res.statusText}`);
    }

    const data = await res.json() as TmdbMovieResults;

    return data;
}

export async function getMovie(tmdbId: number): Promise<TmdbFullMovieInfo> {
    const url = new URL(`https://api.themoviedb.org/3/movie/${tmdbId}`);
    url.searchParams.set('append_to_response', 'external_ids,credits');
    const options = {
        method: 'GET',
        headers: {
            accept: 'application/json',
            Authorization: `Bearer ${process.env.TMDB_KEY!}`,
        },
    };

    const result = await fetch(url, options);
    if (!result.ok) {
        throw new Error(`failed to get full movie info ${result.status} - ${result.statusText}`);
    }

    const movie = await result.json() as TmdbFullMovieInfo;
    return movie;
}