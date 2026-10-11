import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '@/lib/mazos/paths';

export const dynamic = 'force-dynamic';

function readSmall(relative: string): Record<string, unknown> | null {
  try {
    const content = fs.readFileSync(path.join(DATA_DIR, relative), 'utf8');
    if (content.length > 3000) return null;
    const parsed: unknown = JSON.parse(content);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}
function recent(iso: unknown, ms: number): boolean {
  if (typeof iso !== 'string') return false;
  const timestamp = Date.parse(iso);
  return Number.isFinite(timestamp) && Date.now() >= timestamp - 1000 && Date.now() - timestamp <= ms;
}
export async function GET() {
  if (process.env.VERCEL) return NextResponse.json({connected:false, state:'unavailable', event:null});
  const status = readSmall('wakeword-status.json');
  const event = readSmall('wakeword-event.json');
  const connected = recent(status?.at, 7500) && (status?.status === 'listening' || status?.status === 'capture-window');
  const safeEvent = recent(event?.at, 12000) && typeof event?.id === 'string'
    ? {id: String(event.id).slice(0,70), at: event.at}
    : null;
  return NextResponse.json({
    connected,
    state: connected ? status?.status : 'offline',
    engine: connected ? 'openWakeWord' : null,
    event: connected ? safeEvent : null,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
