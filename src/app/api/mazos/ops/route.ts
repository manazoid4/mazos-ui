import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { NextResponse } from 'next/server';
import { DATA_DIR, LOOP_RUNS } from '@/lib/mazos/paths';
import { foldLoopState, type LoopEvent } from '@/lib/mazos/loopEngine';
import { allLoopTemplates } from '@/lib/mazos/loopFactory';
import { receiptSignals, readRunReceipts } from '@/lib/mazos/loopReceipts';

// One-glance state of everything: triage freshness, scheduler health, loop
// deck summary, receipt nines. Read-only — the monitoring half of "loops run
// auto, I watch state".

const TRIAGE_MD = path.join(DATA_DIR, 'triage.md');
const PROPOSED = path.join(DATA_DIR, 'proposed-loops.json');

function schedulerState() {
  try {
    const csv = execFileSync('schtasks', ['/query', '/tn', 'MAZos Morning Triage', '/fo', 'csv', '/v'], { encoding: 'utf8', timeout: 10_000 });
    const [header, row] = csv.trim().split('\n');
    if (!header || !row) return { registered: false };
    const keys = header.split('","').map(s => s.replace(/^"|"$/g, ''));
    const vals = row.split('","').map(s => s.replace(/^"|"$/g, ''));
    const get = (k: string) => vals[keys.findIndex(x => x.toLowerCase().includes(k))] || null;
    return {
      registered: true,
      status: get('status'),
      lastRun: get('last run time'),
      lastResult: get('last result'),
      nextRun: get('next run time'),
    };
  } catch { return { registered: false }; }
}

function triageState() {
  if (!fs.existsSync(TRIAGE_MD)) return { ran: false, lastRun: null, findings: 0, ageHours: null };
  const text = fs.readFileSync(TRIAGE_MD, 'utf8');
  const lastRun = text.match(/Last run:\s*(\S+)/)?.[1] || fs.statSync(TRIAGE_MD).mtime.toISOString();
  const findings = (text.match(/^\|/gm) || []).length - 2; // minus header + divider
  const ageHours = Math.round((Date.now() - Date.parse(lastRun)) / 36e5);
  return { ran: true, lastRun, findings: Math.max(0, findings), ageHours: Number.isFinite(ageHours) ? ageHours : null };
}

function proposals() {
  try {
    const parsed = JSON.parse(fs.readFileSync(PROPOSED, 'utf8'));
    return Array.isArray(parsed.proposals) ? { generatedAt: parsed.generatedAt || null, appOffline: !!parsed.appOffline, proposals: parsed.proposals.slice(0, 8) } : { generatedAt: null, appOffline: false, proposals: [] };
  } catch { return { generatedAt: null, appOffline: false, proposals: [] }; }
}

export async function GET() {
  const events: LoopEvent[] = fs.existsSync(LOOP_RUNS)
    ? fs.readFileSync(LOOP_RUNS, 'utf8').trim().split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as LoopEvent[]
    : [];
  const loops = foldLoopState(allLoopTemplates(), events, receiptSignals());
  const receipts = readRunReceipts(undefined, 200);
  const week = receipts.filter(r => Date.now() - Date.parse(r.at) < 7 * 864e5);
  const triageEvents = events.filter(e => e.loopId === 'mazos_triage');

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    scheduler: schedulerState(),
    triage: { ...triageState(), lastEvent: triageEvents.at(-1) || null, runs7d: triageEvents.filter(e => Date.now() - Date.parse(e.at) < 7 * 864e5).length },
    proposed: proposals(),
    loops: {
      total: loops.length,
      running: loops.filter(l => l.status === 'running').length,
      gated: loops.filter(l => l.status === 'gated').length,
      circuitOpen: loops.filter(l => l.circuitOpen).length,
      trusted: loops.filter(l => l.trusted).length,
    },
    receipts: {
      week: week.length,
      passRate: week.length ? Math.round(100 * week.filter(r => r.outcome === 'pass').length / week.length) : null,
      last: receipts.at(-1) ? { loopId: receipts.at(-1)!.loopId, at: receipts.at(-1)!.at, outcome: receipts.at(-1)!.outcome } : null,
    },
  });
}
