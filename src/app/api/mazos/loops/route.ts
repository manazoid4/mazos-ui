import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { LOOP_RUNS, LOOPS_STATE, DECISIONS_LOG } from '@/lib/mazos/paths';
import { foldLoopState, type LoopEvent, type LoopEventType, type LoopStopReason } from '@/lib/mazos/loopEngine';
import { allLoopTemplates } from '@/lib/mazos/loopFactory';
import { appendLoopReceipt, captureLoopRunReceipt, readRunReceipts, receiptSignals } from '@/lib/mazos/loopReceipts';
import { runAction } from '@/lib/mazos/commandRegistry';

function readEvents(): LoopEvent[] {
  if (!fs.existsSync(LOOP_RUNS)) return [];
  return fs.readFileSync(LOOP_RUNS, 'utf8').trim().split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as LoopEvent[];
}

function loopStates() {
  const templates = allLoopTemplates();
  const states = foldLoopState(templates, readEvents(), receiptSignals());
  return states.map(s => ({ ...s, lastRunReceipt: readRunReceipts(s.def.id, 1).at(-1) || null }));
}

export async function GET() {
  return NextResponse.json({ loops: loopStates() });
}

const EVENT_TYPES: LoopEventType[] = ['start', 'iteration', 'complete', 'stop', 'gate'];
const STOP_REASONS: LoopStopReason[] = ['done', 'no-progress', 'budget', 'manual'];

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const loopId = String(body?.loopId || '');
  const type = String(body?.type || '');
  const templates = allLoopTemplates();
  const def = templates.find(l => l.id === loopId);
  if (!def) return NextResponse.json({ error: 'Unknown loop' }, { status: 400 });

  // v2 machine actions -------------------------------------------------------
  // 'verify': run the loop's registered verify actions, return results only.
  if (type === 'verify') {
    const ids = def.verifyActionIds || [];
    if (!ids.length) return NextResponse.json({ error: 'No verify action registered for this loop.' }, { status: 400 });
    const results = [];
    for (const id of ids) results.push(await runAction(id));
    return NextResponse.json({ ok: true, results, loops: loopStates() });
  }

  // 'receipt': machine-filled iteration receipt — verify + git + criteria.
  if (type === 'receipt') {
    const receipt = await captureLoopRunReceipt(def, String(body?.note || ''));
    const at = new Date().toISOString();
    const event: LoopEvent = { loopId, at, type: 'iteration', summary: `receipt ${receipt.outcome}: ${receipt.note || receipt.verify.map(v => v.actionId).join(',')}` };
    fs.mkdirSync(path.dirname(LOOP_RUNS), { recursive: true });
    fs.appendFileSync(LOOP_RUNS, `${JSON.stringify(event)}\n`, 'utf8');
    return NextResponse.json({ ok: true, receipt, loops: loopStates() });
  }

  // Legacy events ------------------------------------------------------------
  if (!EVENT_TYPES.includes(type as LoopEventType)) return NextResponse.json({ error: 'Unknown event type' }, { status: 400 });

  // Completion gate: a loop completes only on hard evidence — last machine
  // receipt passed AND (when criteria exist) every criterion passes.
  if (type === 'complete') {
    const last = readRunReceipts(loopId, 1).at(-1) || null;
    if (!last) return NextResponse.json({ error: 'Cannot complete: no machine receipt exists. Click "Log receipt" after a verified iteration first.' }, { status: 400 });
    if (last.outcome !== 'pass') return NextResponse.json({ error: `Cannot complete: last receipt is "${last.outcome}"${last.criteriaTampered ? ' (criteria tampered)' : ''}. Fix and log a passing receipt.` }, { status: 400 });
    if (last.criteriaHash && !last.criteriaAllPass) return NextResponse.json({ error: 'Cannot complete: criteria.json still has failing items.' }, { status: 400 });
  }

  const at = new Date().toISOString();
  const event: LoopEvent = { loopId, at, type: type as LoopEventType };
  if (body.summary) event.summary = String(body.summary).slice(0, 500);
  if (type === 'stop') event.reason = STOP_REASONS.includes(body.reason) ? body.reason : 'manual';

  fs.mkdirSync(path.dirname(LOOP_RUNS), { recursive: true });
  fs.appendFileSync(LOOP_RUNS, `${JSON.stringify(event)}\n`, 'utf8');
  const receipt = appendLoopReceipt(def, event);

  // A gate is a human question: file it in the Decision strip so nothing waits silently.
  if (type === 'gate') {
    const decision = {
      id: `d-${Date.now().toString(36)}`, at, type: 'open', source: loopId,
      question: String(body.gateQuestion || `${def.name} hit a human gate.`).slice(0, 300),
      context: String(body.gateContext || event.summary || '').slice(0, 500),
      options: ['approve', 'deny'],
    };
    fs.appendFileSync(DECISIONS_LOG, `${JSON.stringify(decision)}\n`, 'utf8');
  }

  const loops = loopStates();
  fs.writeFileSync(LOOPS_STATE, JSON.stringify({ updatedAt: at, loops: loops.map(l => ({ id: l.def.id, status: l.status, iteration: l.iteration, startedAt: l.startedAt, stopReason: l.stopReason })) }, null, 2));
  return NextResponse.json({ ok: true, loops, receipt });
}
