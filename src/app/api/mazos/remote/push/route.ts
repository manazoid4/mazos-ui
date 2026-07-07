import { NextResponse } from 'next/server';
import { checkRemoteWriteAuth } from '@/lib/mazos/remoteAuth';
import { saveRemoteSnapshot } from '@/lib/mazos/remoteStore';
import type { RemoteSnapshot } from '@/lib/mazos/remoteSnapshot';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = checkRemoteWriteAuth(req, 'MAZOS_REMOTE_SYNC_TOKEN');
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null) as RemoteSnapshot | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'Expected a remote snapshot JSON body.' }, { status: 400 });
  }

  return NextResponse.json(saveRemoteSnapshot(body));
}
