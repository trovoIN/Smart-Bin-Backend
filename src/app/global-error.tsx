'use client';

import { useEffect } from 'react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('Global Error:', error);
    }, [error]);

    return (
        <html lang="en">
            <body>
                <div style={{
                    padding: '2rem',
                    fontFamily: 'system-ui, sans-serif',
                    textAlign: 'center'
                }}>
                    <h2>Something went wrong!</h2>
                    <p>{error.message || 'An unexpected error occurred.'}</p>
                    <button
                        onClick={() => reset()}
                        style={{
                            padding: '0.5rem 1rem',
                            cursor: 'pointer',
                            backgroundColor: '#0070f3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px'
                        }}
                    >
                        Try again
                    </button>
                </div>
            </body>
        </html>
    );
}
