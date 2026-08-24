'use client';

import { useEffect } from 'react';

export default function HomePage() {
  useEffect(() => {
    window.location.replace('/call-desk');
  }, []);

  return (
    <main className="callDeskShell" aria-live="polite">
      <div className="callCard">
        <p className="callKicker">MAZ WORKS · LOCAL WINDOWS WORKSTATION</p>
        <h1>OPENING CALL DESK</h1>
        <p className="callSubtitle">Loading the Maz Works prospect and calling workspace…</p>
      </div>
    </main>
  );
}
