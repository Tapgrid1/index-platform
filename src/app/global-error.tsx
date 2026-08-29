'use client';

/**
 * Last resort: a failure in the root layout itself, which error.tsx cannot
 * catch because it renders inside that layout. This one replaces the whole
 * document, so it ships its own <html> and <body> and cannot rely on the
 * stylesheet the layout would have loaded — hence the inline styles.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: '#fff',
          color: '#0a0a0a',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          display: 'grid',
          placeItems: 'center',
          minHeight: '100vh',
          padding: '24px',
        }}
      >
        <main style={{ maxWidth: '460px' }}>
          <div
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '10.5px',
              textTransform: 'uppercase',
              letterSpacing: '0.16em',
              color: '#767676',
            }}
          >
            the index
          </div>
          <h1
            style={{
              fontSize: '30px',
              fontWeight: 700,
              letterSpacing: '-0.04em',
              lineHeight: 1.1,
              margin: '10px 0 14px',
            }}
          >
            The site failed to load.
          </h1>
          <p style={{ color: '#3d3d3d', margin: '0 0 26px', lineHeight: 1.6 }}>
            This one is ours. Reloading usually clears it.
          </p>
          <button
            onClick={reset}
            style={{
              height: '40px',
              padding: '0 20px',
              background: '#0a0a0a',
              color: '#fff',
              border: 0,
              borderRadius: '2px',
              fontSize: '13.5px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
          {error.digest && (
            <p
              style={{
                marginTop: '30px',
                paddingTop: '16px',
                borderTop: '1px solid #e6e6e6',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '11px',
                color: '#767676',
              }}
            >
              Reference <b style={{ color: '#0a0a0a' }}>{error.digest}</b>
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
