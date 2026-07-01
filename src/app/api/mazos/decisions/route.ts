import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { DECISIONS_LOG } from '@/lib/mazos/paths';
import { foldDecisions, type DecisionEvent } from '@/lib/mazos/decisions';

function readEvents(): DecisionEvent[] {
  if (!fs.existsSync(DECISIONS_LOG)) return [];
  return fs.readFileSync(DECISIONS_LOG, 'utf8').trim().split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as DecisionEvent[];
}

export async function GET() {
  return NextResponse.json({ decisions: foldDecisions(readEvents()) });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const at = new Date().toISOString();
  let event: DecisionEvent;

  if (body?.type === 'open') {
    if (!String(body.question || '').trim()) return NextResponse.json({ error: 'Question required' }, { status: 400 });
    event = { id: `d-${Date.now().toString(36)}`, at, type: 'open', source: String(body.source || 'manual').slice(0, 60), question: String(body.question).slice(0, 300), context: String(body.context || '').slice(0, 500), options: ['approve', 'deny'] };
  } else if (body?.type === 'resolve') {
    const status = ['approved', 'denied', 'answered'].includes(body.status) ? body.status : 'answered';
    if (!String(body.id || '').trim()) return NextResponse.json({ error: 'Decision id required' }, { status: 400 });
    event = { id: String(body.id), at, type: 'resolve', status, resolution: String(body.resolution || '').slice(0, 500) };
  } else {
    return NextResponse.json({ error: 'type must be open or resolve' }, { status: 400 });
  }

  fs.mkdirSync(path.dirname(DECISIONS_LOG), { recursive: true });
  fs.appendFileSync(DECISIONS_LOG, `${JSON.stringify(event)}\n`, 'utf8');
  return NextResponse.json({ ok: true, decisions: foldDecisions(readEvents()) });
}
