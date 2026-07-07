import { NextResponse } from 'next/server';
import { applyReaperRecommendation, buildClutterReaperReport } from '@/lib/mazos/clutterReaper';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(buildClutterReaperReport());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || '');
  if (!id) return NextResponse.json({ ok: false, error: 'Missing recommendation id.' }, { status: 400 });
  const result = applyReaperRecommendation(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
