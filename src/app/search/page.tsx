import Link from "next/link";
import { searchTmdb } from "@/tmdb";
import { ReactNode } from "react";
import Movie, { ApiMovie } from "@/components/movie";
import db from "@/db";

type Props = {
    searchParams: Promise<{
        q: string;
        cat?: 'movie'|'actor'|'character'|'line';
        p?: number;
    }>;
};

export default async function SearchPage({ searchParams }: Props) {
    const { q, p } = await searchParams;
    const data = await searchTmdb(q, p);

    let prev = <span>prev</span>;
    if (data.page > 1) {
        prev = <Link href={`/search?q=${encodeURIComponent(q)}&p=${data.page - 1}`}>previous</Link>
    }

    let next = <span>next</span>;
    if (data.total_pages > data.page) {
        next = <Link href={`/search?q=${encodeURIComponent(q)}&p=${data.page + 1}`}>next</Link>
    }

    const ids = await db.movie.findMany({
        select: {
            id: true,
            tmdbId: true,
        },
        where: {
            tmdbId: {
                in: data.results.map(
                    m => m.id
                )
            }
        }
    });

    const idMap = new Map<number, number>();
    for (const idPair of ids) {
        idMap.set(idPair.tmdbId!, idPair.id);
    }

    const movies: ReactNode[] = [];
    for (const movieInfo of data.results) {
        const movie = {
            id: idMap.get(movieInfo.id),
            title: movieInfo.title,
            description: movieInfo.overview,
            tmdbId: movieInfo.id,
            posterUrl: movieInfo.poster_path ? `https://image.tmdb.org/t/p/w600_and_h900_bestv2/${movieInfo.poster_path}` : null,
        } as ApiMovie;

        movies.push(
            <Movie
                key={movieInfo.id}
                movie={movie}
            />
        )
    }

    return <div>
        {movies}
        <div>{prev} | {next}</div>
    </div>
}
