import Link from "next/link";
import "dot-env";

type Props = {
    searchParams: Promise<{
        q: string;
        cat?: 'movie'|'actor'|'character'|'line';
        p?: number;
    }>;
};

type Movie = {
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

type MovieResults = {
    page: number;
    results: Movie[];
    total_pages: number;
    total_results: number;
}

export default async function SearchPage({ searchParams }: Props) {
    const { q, p } = await searchParams;

    const url = new URL('https://api.themoviedb.org/3/search/movie');
    url.searchParams.set('query', q);
    url.searchParams.set('language', 'en-US');
    if (p) {
        url.searchParams.set('page', p.toString(10));
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
        return <div>failed {res.status} - {res.statusText}</div>
    }

    const data = await res.json() as MovieResults;

    console.log(data);

    let prev = <span>prev</span>;
    if (data.page > 1) {
        prev = <Link href={`/search?q=${encodeURIComponent(q)}&p=${data.page - 1}`}>previous</Link>
    }

    let next = <span>next</span>;
    if (data.total_pages > data.page) {
        next = <Link href={`/search?q=${encodeURIComponent(q)}&p=${data.page + 1}`}>next</Link>
    }

    return <div style={{
        whiteSpace: 'pre-wrap'
    }}>
        {
            data.results.map(
                movie => <Link key={movie.id} href={`https://www.themoviedb.org/movie/${movie.id}`}>{movie.poster_path ? <img src={`https://image.tmdb.org/t/p/w600_and_h900_bestv2${movie.poster_path}`} alt={movie.title} width={120}/> :
                <div style={{
                    width: '120px',
                    display: 'inline-block',
                    minHeight: '180px',
                }}>{movie.title}</div>}</Link>
            )
        }
        <div>{prev} | {next}</div>
    </div>
}
