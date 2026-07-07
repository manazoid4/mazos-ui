import { NextResponse } from 'next/server';
import { buildRemoteSnapshot } from '@/lib/mazos/remoteSnapshot';
import { readLatestRemoteSnapshot } from '@/lib/mazos/remoteStore';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get('source') === 'published') {
    const snapshot = readLatestRemoteSnapshot();
    if (snapshot) return NextResponse.json(snapshot);
  }

  return NextResponse.json(await buildRemoteSnapshot());
}
