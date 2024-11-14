'use client';
import { ReactNode, useCallback } from 'react';
import styles from './movie.module.css';
import TheatersIcon from '@mui/icons-material/Theaters';
import Link from 'next/link';

export type ApiMovie = {
    id?: number;
    title: string;
    posterUrl?: string;
    description?: string;
    tmdbId?: number;
    imdbId?: string;
};

type Props = {
    movie: ApiMovie;
}

export default function Movie({ movie }: Props) {
    const addMovie = useCallback(
        async () => {
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({tmdbId: movie.tmdbId}),
            };
            const res = await fetch('/api/movies/add', options);
            if (!res.ok) {
                alert('failed to add');
                return;
            }
            const { id } = await res.json();
            movie.id = id;
        },
        [movie]
    )
    let button: ReactNode;
    if (movie.id) {
        button = <Link href={`/movie/${movie.id}`}>Local</Link>
    } else {
        button = <button onClick={addMovie}>Add Movie</button>
    }

    return <div className={styles.container}>
        {
            (movie.posterUrl &&
                <img src={movie.posterUrl} className={styles.poster}/>
            ) ?? <div className={`${styles.poster} ${styles.noPoster}`}>
                <TheatersIcon/><br/>
                <div>No Poster</div>
                </div>
        }
        <div className={styles.info}>
            <h2>{movie.title}</h2>
            <div className={styles.description}>{movie.description}</div>
            <div className={styles.buttons}>{button}</div>
        </div>
    </div>
}
