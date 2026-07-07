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

// A loop that has run for days without a single receipt is theatre, not work:
// the doctor may not call it "keep" until it produces evidence.
const RECEIPTLESS_GRACE_DAYS = 3;
function withAudit(loop: ReturnType<typeof foldLoopState>[number]) {
  const receipts = receiptSummary(loop.def.id);
  const audit = auditLoopUsefulness(loop.def);
  const ageDays = loop.startedAt ? (Date.now() - new Date(loop.startedAt).getTime()) / 864e5 : 0;
  if (receipts.count === 0 && ageDays > RECEIPTLESS_GRACE_DAYS && (loop.status === 'running' || loop.status === 'gated')) {
    if (audit.decision === 'keep') { audit.decision = 'revise'; audit.label = 'Useful after tightening'; }
    audit.gaps = ['No receipts logged — loop is running without evidence.', ...audit.gaps].slice(0, 5);
  }
  return { ...loop, audit, receipts };
}

export async function GET() {
  const templates = allLoopTemplates();
  return NextResponse.json({ loops: foldLoopState(templates, readEvents()).map(withAudit) });
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

  // Receipts gate: a loop cannot be declared complete without at least one
  // logged iteration carrying evidence.
  if (type === 'complete') {
    const hasEvidence = readEvents().some(e => e.loopId === loopId && e.type === 'iteration' && String(e.summary || '').trim());
    if (!hasEvidence) return NextResponse.json({ error: 'Cannot complete: log at least one iteration with a one-line evidence summary first.' }, { status: 400 });
  }

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

  const loops = foldLoopState(templates, readEvents()).map(withAudit);
  fs.writeFileSync(LOOPS_STATE, JSON.stringify({ updatedAt: at, loops: loops.map(l => ({ id: l.def.id, status: l.status, iteration: l.iteration, startedAt: l.startedAt, stopReason: l.stopReason })) }, null, 2));
  return NextResponse.json({ ok: true, loops, receipt });
}
