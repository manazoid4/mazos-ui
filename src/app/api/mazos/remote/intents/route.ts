import { NextResponse } from 'next/server';
import { checkRemoteWriteAuth } from '@/lib/mazos/remoteAuth';
import { appendRemoteIntent, parseRemoteIntent, readRemoteIntents } from '@/lib/mazos/remoteStore';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = checkRemoteWriteAuth(req, 'MAZOS_REMOTE_READ_TOKEN');
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const limit = Number(new URL(req.url).searchParams.get('limit') || 50);
  return NextResponse.json({ generatedAt: new Date().toISOString(), intents: readRemoteIntents(limit) });
}

export async function POST(req: Request) {
  const auth = checkRemoteWriteAuth(req, 'MAZOS_REMOTE_SYNC_TOKEN');
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const intent = parseRemoteIntent(await req.json());
    return NextResponse.json(appendRemoteIntent(intent));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid remote intent.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
