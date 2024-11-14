import db from "@/db";
import { NextRequest, NextResponse } from "next/server";

export type ApiMovie = {
    id: number;
    posterUrl: string | null;
    title: string;
    year: number | null;
    tmdbId: number | null;
}

export async function GET(request: NextRequest): Promise<NextResponse<ApiMovie|string>> {
    const tmdbIdStr = request.nextUrl.searchParams.get('tmdbId');
    if (!tmdbIdStr) {
        return new NextResponse<ApiMovie|string>('No tmdbId specified', {status: 401, statusText: 'No tmdbId specified'});
    }

    const tmdbId = parseInt(tmdbIdStr, 10);
    if (Number.isNaN(tmdbId)) {
        return new NextResponse<ApiMovie|string>('Bad tmdbId specified', {status: 401, statusText: 'Bad tmdbId'});
    }

    const movie = await db.movie.findFirst({
        select: {
            id: true,
            title: true,
            year: true,
            posterUrl: true,
            tmdbId: true,
        },
        where: {
            tmdbId,
        }
    });

    if (!movie) {
        return new NextResponse<ApiMovie|string>('Not Found', {status: 404, statusText: 'Not Found'});
    }

    return NextResponse.json(movie);
}
