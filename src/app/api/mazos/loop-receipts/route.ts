import { NextResponse } from 'next/server';
import { readLoopReceipts } from '@/lib/mazos/loopReceipts';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const loopId = url.searchParams.get('loopId') || undefined;
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 80)));
  return NextResponse.json({ generatedAt: new Date().toISOString(), receipts: readLoopReceipts(limit, loopId) });
}
