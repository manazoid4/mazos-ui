import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { CALL_DESK_PROSPECTS } from '@/lib/mazos/paths';
import { callReadiness, normalizeProspect, statusForOutcome, type CallOutcome, type CallRecord, type Prospect } from '@/lib/mazos/callDesk';
import { isLocalCallDeskRequest } from '@/lib/mazos/callDeskAccess';

function readProspects(): Prospect[] {
  if (!fs.existsSync(CALL_DESK_PROSPECTS)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(CALL_DESK_PROSPECTS, 'utf8'));
    return Array.isArray(parsed?.prospects) ? parsed.prospects : [];
  } catch { return []; }
}

function writeProspects(prospects: Prospect[]) {
  fs.mkdirSync(path.dirname(CALL_DESK_PROSPECTS), { recursive: true });
  const temporary = `${CALL_DESK_PROSPECTS}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify({ version: 1, prospects }, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, CALL_DESK_PROSPECTS);
}

export async function GET(req: Request) {
  if (!isLocalCallDeskRequest(req)) return NextResponse.json({ error: 'Maz Works Call Desk is available only in the local Windows app.' }, { status: 403 });
  return NextResponse.json({ prospects: readProspects() });
}

export async function POST(req: Request) {
  if (!isLocalCallDeskRequest(req)) return NextResponse.json({ error: 'Maz Works Call Desk is available only in the local Windows app.' }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || !['upsert', 'call'].includes(body.action)) return NextResponse.json({ error: 'action must be upsert or call' }, { status: 400 });
  const prospects = readProspects();
  try {
    if (body.action === 'upsert') {
      const requestedId = String(body.prospect?.id || '');
      const index = prospects.findIndex(item => item.id === requestedId);
      const prospect = normalizeProspect(body.prospect || {}, index >= 0 ? prospects[index] : undefined);
      if (['new', 'researching', 'ready'].includes(prospect.status)) prospect.status = callReadiness(prospect).ready ? 'ready' : prospect.websiteAudit ? 'researching' : 'new';
      if (index >= 0) prospects[index] = prospect; else prospects.unshift(prospect);
    } else {
      const index = prospects.findIndex(item => item.id === String(body.id || ''));
      if (index < 0) return NextResponse.json({ error: 'Prospect not found.' }, { status: 404 });
      const outcome = String(body.outcome || '') as CallOutcome;
      if (!['no_answer', 'gatekeeper', 'interested', 'follow_up', 'booked', 'not_interested', 'do_not_call'].includes(outcome)) throw new Error('Choose a valid call outcome.');
      const call: CallRecord = {
        id: String(body.callId || '').trim().slice(0, 100) || `call-${Date.now().toString(36)}`, at: new Date().toISOString(), outcome,
        notes: String(body.notes || '').trim().slice(0, 5000),
        nextAction: String(body.nextAction || '').trim().slice(0, 500),
        followUpAt: String(body.followUpAt || '').trim().slice(0, 40),
      };
      const existing = prospects[index];
      if (existing.calls.some(item => item.id === call.id)) return NextResponse.json({ ok: true, prospects });
      prospects[index] = normalizeProspect({
        ...existing, status: statusForOutcome(outcome), nextAction: call.nextAction, followUpAt: call.followUpAt,
        calls: [...existing.calls, call],
        screening: outcome === 'do_not_call' ? { ...existing.screening, ownList: 'blocked', note: `${existing.screening.note}${existing.screening.note ? ' | ' : ''}Do not call requested ${call.at.slice(0, 10)}` } : existing.screening,
      }, existing);
    }
    writeProspects(prospects);
    return NextResponse.json({ ok: true, prospects });
  } catch (reason) {
    return NextResponse.json({ error: reason instanceof Error ? reason.message : String(reason) }, { status: 400 });
  }
}
