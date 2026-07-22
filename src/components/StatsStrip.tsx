'use client';
import { useEffect, useState } from 'react';

export function StatsStrip() {
  const [stats, setStats] = useState<{ todayCostUsd: number | null; contextPercent: number | null } | null>(null);

  useEffect(() => {
    fetch('/api/mazos/stats').then((r) => r.json()).then(setStats);
  }, []);

  if (!stats) return null;

  return (
    <div className="statsStrip">
      <span>Cost today: {stats.todayCostUsd !== null ? `$${stats.todayCostUsd.toFixed(2)}` : '—'}</span>
      <span>Context: {stats.contextPercent !== null ? `${stats.contextPercent}%` : '—'}</span>
    </div>
  );
}
