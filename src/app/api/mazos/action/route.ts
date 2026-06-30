import { NextResponse } from 'next/server';
import { runAction } from '@/lib/mazos/commandRegistry';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || body.actionId || body.command_value || '');
  if (!id) return NextResponse.json({ error: 'Missing action id' }, { status: 400 });
  return NextResponse.json(await runAction(id));
}
