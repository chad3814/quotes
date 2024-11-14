import db, { Prisma } from "@/db";
import { NextRequest, NextResponse } from "next/server";
import { ApiMovie } from "../../route";

export async function GET(request: NextRequest): Promise<NextResponse<ApiMovie[]|string>> {
    const q = request.nextUrl.searchParams.get('q');
    if (!q) {
        return new NextResponse<ApiMovie[]|string>('No query specified', {status: 401, statusText: 'No query specified'});
    }
    const tokens = q.split(/\s+/u);
    const movies: ApiMovie[] = [];
    const OR: Prisma.MovieWhereInput[] = [];
    for (const t of tokens) {
        OR.push({
            title: {
                search: t
            }
        }, {
            description: {
                search: t
            }
        });
    }
    const query: Prisma.MovieFindManyArgs = {
        select: {
            id: true,
            title: true,
            year: true,
            posterUrl: true,
        },
        where: {
            OR,
        }
    };
    const results = await db.movie.findMany(query);
    for (const movie of results) {
        movies.push(movie);
    }

    return NextResponse.json(movies);
}