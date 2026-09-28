'use client';

/** Last-resort boundary when the root layout itself fails; renders its own <html>. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0, background: '#f8fafc', color: '#0f172a' }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>SolarFlow hit an unexpected error</h1>
          <p style={{ color: '#64748b', fontSize: 14 }}>Please reload the page.</p>
          <button type="button" onClick={reset} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, border: 0, background: '#1e3a8a', color: '#fff', cursor: 'pointer' }}>
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
