import db from "@/db";

type Props = {
    params: Promise<{
        id: string;
    }>;
};

export default async function MoviePage({ params }: Props) {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    const movie = await db.movie.findFirst({
        include: {
            cast: {
                include: {
                    actor: {
                        select: {
                            id: true,
                            name: true,
                            photoUrl: true,
                        },
                    },
                },
            },
            quotes: {
                include: {
                    lines: {
                        select: {
                            id: true,
                            text: true,
                            characterId: true,
                            quoteOrder: true,
                        }
                    }
                }
            }
        },
        where: {
            id
        }
    });

    return <pre>{JSON.stringify(movie, null, 4)}</pre>
}