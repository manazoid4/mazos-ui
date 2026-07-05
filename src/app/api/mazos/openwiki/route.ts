import { NextResponse } from 'next/server';
import { buildOpenWikiAction, getOpenWikiStatus } from '@/lib/mazos/openWiki';

export async function GET() {
  return NextResponse.json(getOpenWikiStatus());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = typeof body.action === 'string' ? body.action : '';
  const result = buildOpenWikiAction(action);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
