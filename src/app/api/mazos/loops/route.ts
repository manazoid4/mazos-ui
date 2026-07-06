import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { LOOP_RUNS, LOOPS_STATE, DECISIONS_LOG } from '@/lib/mazos/paths';
import { foldLoopState, type LoopEvent, type LoopEventType, type LoopStopReason } from '@/lib/mazos/loopEngine';
import { allLoopTemplates, auditLoopUsefulness } from '@/lib/mazos/loopFactory';
import { appendLoopReceipt, receiptSummary } from '@/lib/mazos/loopReceipts';

function readEvents(): LoopEvent[] {
  if (!fs.existsSync(LOOP_RUNS)) return [];
  return fs.readFileSync(LOOP_RUNS, 'utf8').trim().split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as LoopEvent[];
}

export async function GET() {
  const templates = allLoopTemplates();
  return NextResponse.json({
    loops: foldLoopState(templates, readEvents()).map((loop) => ({ ...loop, audit: auditLoopUsefulness(loop.def), receipts: receiptSummary(loop.def.id) })),
  });
}

const EVENT_TYPES: LoopEventType[] = ['start', 'iteration', 'complete', 'stop', 'gate'];
const STOP_REASONS: LoopStopReason[] = ['done', 'no-progress', 'budget', 'manual'];

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const loopId = String(body?.loopId || '');
  const type = body?.type as LoopEventType;
  const templates = allLoopTemplates();
  const def = templates.find(l => l.id === loopId);
  if (!def || !EVENT_TYPES.includes(type)) return NextResponse.json({ error: 'Unknown loop or event type' }, { status: 400 });

  const at = new Date().toISOString();
  const event: LoopEvent = { loopId, at, type };
  if (body.summary) event.summary = String(body.summary).slice(0, 500);
  if (type === 'stop') event.reason = STOP_REASONS.includes(body.reason) ? body.reason : 'manual';

  fs.mkdirSync(path.dirname(LOOP_RUNS), { recursive: true });
  fs.appendFileSync(LOOP_RUNS, `${JSON.stringify(event)}\n`, 'utf8');
  const receipt = appendLoopReceipt(def, event);

  // A gate is a human question: file it in the Decision Inbox so nothing waits silently.
  if (type === 'gate') {
    const decision = {
      id: `d-${Date.now().toString(36)}`, at, type: 'open', source: loopId,
      question: String(body.gateQuestion || `${def.name} hit a human gate.`).slice(0, 300),
      context: String(body.gateContext || event.summary || '').slice(0, 500),
      options: ['approve', 'deny'],
    };
    fs.appendFileSync(DECISIONS_LOG, `${JSON.stringify(decision)}\n`, 'utf8');
  }

  const loops = foldLoopState(templates, readEvents()).map((loop) => ({ ...loop, audit: auditLoopUsefulness(loop.def), receipts: receiptSummary(loop.def.id) }));
  fs.writeFileSync(LOOPS_STATE, JSON.stringify({ updatedAt: at, loops: loops.map(l => ({ id: l.def.id, status: l.status, iteration: l.iteration, startedAt: l.startedAt, stopReason: l.stopReason })) }, null, 2));
  return NextResponse.json({ ok: true, loops, receipt });
}
