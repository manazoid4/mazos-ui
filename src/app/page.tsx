'use client';

import { useEffect } from 'react';

export default function HomePage() {
  useEffect(() => {
    window.location.replace('/command-center');
  }, []);

  return <main style={{ padding: 40 }} aria-live="polite"><p>Opening MAZos Command Centre…</p></main>;
}
