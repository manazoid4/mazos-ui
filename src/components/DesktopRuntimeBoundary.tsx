'use client';

import { useEffect, useState } from 'react';
import { getRuntimeStatus, type RuntimeStatus } from '@/lib/mazos/runtimeClient';

export function DesktopRuntimeBoundary({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getRuntimeStatus()
      .then(setStatus)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
      });
  }, []);

  if (error) {
    return (
      <main style={{ maxWidth: 820, margin: '8vh auto', padding: 24 }}>
        <p style={{ fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '.12em' }}>MAZos runtime</p>
        <h1 style={{ fontSize: 36, lineHeight: 1.1 }}>Desktop backend could not start.</h1>
        <p>The application stopped before loading data-dependent panels so the failure would not be hidden.</p>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{error}</pre>
      </main>
    );
  }

  if (!status) {
    return (
      <main style={{ maxWidth: 820, margin: '8vh auto', padding: 24 }}>
        <p style={{ fontFamily: 'monospace' }}>Checking MAZos runtime…</p>
      </main>
    );
  }

  if (status.mode === 'desktop' && !status.standaloneReady) {
    return (
      <main style={{ maxWidth: 900, margin: '6vh auto', padding: 24 }}>
        <p style={{ fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '.12em' }}>MAZos desktop repair gate</p>
        <h1 style={{ fontSize: 42, lineHeight: 1.05, marginBottom: 16 }}>The desktop shell is installed, but the full local backend is not ready.</h1>
        <p style={{ fontSize: 18, lineHeight: 1.6 }}>
          This build is intentionally blocked from loading panels that depend on removed Next.js API routes. It is safer to show the exact limitation than to present an apparently healthy but non-functional dashboard.
        </p>

        <section style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid currentColor' }}>
          <h2>Available now</h2>
          <ul>
            {status.capabilities.map((capability) => <li key={capability}>{capability}</li>)}
          </ul>
        </section>

        <section style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid currentColor' }}>
          <h2>Required before release</h2>
          <ul>
            {status.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
          </ul>
        </section>

        <p style={{ marginTop: 28 }}>
          Continue using the Next.js local development mode for the complete current feature set. Do not replace the active MAZos directory or publish another desktop release yet.
        </p>
      </main>
    );
  }

  return <>{children}</>;
}
