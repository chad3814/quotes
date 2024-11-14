import db from "@/db";
import { getMovie } from "@/tmdb";
import { NextRequest, NextResponse } from "next/server";
import { Movie } from "../../../../../prisma/client";

type AddResponseSuccess = {
    status: 'ok';
    id: number;
};

type AddResponseError = {
    status: 'error';
    message: string;
}

export type AddResponse = AddResponseSuccess | AddResponseError;

export type AddBody = {
    tmdbId: number;
}

export async function POST(request: NextRequest): Promise<NextResponse<AddResponse>> {
    const { tmdbId } = await request.json() as AddBody;

    const fullMovieInfo = await getMovie(tmdbId);

    const movie = await db.$transaction(
        async ($tx) => {
        await $tx.actor.createMany({
            data: fullMovieInfo.credits.cast.filter(
                credit => credit.known_for_department === 'Acting',
            ).map(
                credit => ({
                    name: credit.name,
                    tmdbId: credit.id,
                    photoUrl: credit.profile_path ? `https://media.themoviedb.org/t/p/w300_and_h450_bestv2${credit.profile_path}` : null,
                }),
            ),
            skipDuplicates: true,
        });

        const actors = await $tx.actor.findMany({
            select: {
                id: true,
                tmdbId: true,
            },
            where: {
                tmdbId: {
                    in: fullMovieInfo.credits.cast.map(
                        credit => credit.id
                    )
                }
            }
        });

        const map = new Map<number,number>();
        for (const actor of actors) {
            map.set(actor.tmdbId!, actor.id);
        }

        const movie: Movie = await $tx.movie.create({
            data: {
                tmdbId,
                description: fullMovieInfo.overview,
                posterUrl: fullMovieInfo.poster_path ? `https://image.tmdb.org/t/p/w600_and_h900_bestv2${fullMovieInfo.poster_path}` : null,
                year: new Date(fullMovieInfo.release_date)?.getUTCFullYear() ?? null,
                title: fullMovieInfo.title,
                imdbId: fullMovieInfo.external_ids.imdb_id,
                cast: {
                    createMany: {
                        data: fullMovieInfo.credits.cast.filter(
                            credit => credit.known_for_department === 'Acting'
                        ).map(
                            credit => ({
                                name: credit.character,
                                actorId: map.get(credit.id)!,
                            })
                        ),
                    }
                }
            }
        });

        return movie;
    });

    if (movie) {
        return NextResponse.json({
            status: 'ok',
            id: movie.id
        });
    }
    return NextResponse.json({
        status: 'error',
        message: 'failed to add'
    });
}