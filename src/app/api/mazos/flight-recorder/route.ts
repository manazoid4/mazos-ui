import { NextResponse } from 'next/server';
import { buildFlightRecord } from '@/lib/mazos/flightRecorder';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id') || '';
  const product = url.searchParams.get('product') || undefined;
  if (!id) return NextResponse.json({ error: 'Expected ?id=<feed item id>' }, { status: 400 });
  return NextResponse.json(buildFlightRecord(id, product));
}
