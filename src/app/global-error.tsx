'use client';

/**
 * Last-resort boundary: catches failures in the root layout itself, which
 * error.tsx cannot, because at that point there is no layout left to render
 * into. It has to supply its own <html> and <body>, and it cannot rely on the
 * stylesheet having loaded — hence the inline styles, which are the one place
 * in this codebase they are correct.
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
          fontFamily: 'system-ui, -apple-system, sans-serif',
          maxWidth: 520,
          margin: '0 auto',
          padding: '96px 24px',
          color: '#111',
        }}
      >
        <p
          style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: 10.5,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: '#767676',
          }}
        >
          Something went wrong
        </p>
        <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.04em', margin: '10px 0 12px' }}>
          The index is having a moment.
        </h1>
        <p style={{ color: '#444', lineHeight: 1.6, marginBottom: 28 }}>
          Something failed before the page could be built. Reloading usually fixes it.
        </p>
        <button
          onClick={reset}
          style={{
            height: 40,
            padding: '0 16px',
            background: '#111',
            color: '#fff',
            border: 0,
            borderRadius: 2,
            fontSize: 13.5,
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
        {error.digest && (
          <p style={{ marginTop: 32, fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#999' }}>
            Reference {error.digest}
          </p>
        )}
      </body>
    </html>
  );
}
