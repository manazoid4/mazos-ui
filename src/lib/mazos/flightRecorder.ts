import fs from 'fs';
import { DECISIONS_LOG, LOOP_RUNS } from './paths';
import { foldDecisions, type DecisionEvent } from './decisions';
import { readRuns } from './logStore';
import { TASK_GATE_HISTORY } from './taskGate';
import { MISSION_PLAN_DIR } from './missionPlanner';
import { readLoopReceipts } from './loopReceipts';

export type FlightEvent = {
  at: string;
  kind: 'run' | 'gate' | 'task-gate' | 'mission-plan' | 'loop' | 'receipt';
  label: string;
  ok?: boolean;
  detail?: string;
};

export type FlightRecord = {
  itemId: string;
  product?: string;
  events: FlightEvent[];
  sources: string[];
  notVerified: string[];
};

function readJsonl(file: string, limit: number): any[] {
  try {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).slice(-limit)
      .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch {
    return [];
  }
}

function matches(text: string, product?: string) {
  return !product || text.toLowerCase().includes(product.toLowerCase());
}

// Deterministic flight recorder: replays what MAZos actually logged — runs,
// human gates, task-gate preflights, mission plans, loop events. It never
// invents history; anything not logged lands in notVerified.
export function buildFlightRecord(itemId: string, product?: string): FlightRecord {
  const events: FlightEvent[] = [];
  const sources: string[] = [];

  const runs = readRuns(30) as any[];
  if (runs.length) sources.push('run history');
  for (const r of runs) {
    const text = `${r.label || ''} ${r.actionId || ''} ${r.commandPreview || ''}`;
    if (!matches(text, product)) continue;
    events.push({
      at: r.finishedAt || r.startedAt || '',
      kind: 'run',
      label: `${r.success ? 'passed' : 'FAILED'}: ${r.label || r.actionId}`,
      ok: !!r.success,
      detail: r.commandPreview || undefined,
    });
  }

  const decisionEvents = readJsonl(DECISIONS_LOG, 200) as DecisionEvent[];
  if (decisionEvents.length) sources.push('decision inbox');
  for (const d of foldDecisions(decisionEvents)) {
    if (!matches(`${d.question} ${d.context || ''}`, product)) continue;
    events.push({
      at: d.resolvedAt || d.createdAt,
      kind: 'gate',
      label: d.status === 'open' ? `gate OPEN: ${d.question}` : `gate ${d.status}: ${d.question}`,
      ok: d.status !== 'open' && d.status !== 'denied',
      detail: d.resolution || d.context || undefined,
    });
  }

  const gates = readJsonl(TASK_GATE_HISTORY, 20);
  if (gates.length) sources.push('task-gate preflights');
  for (const g of gates) {
    const task = g?.input?.task || '';
    if (!matches(`${task} ${g?.input?.repoLabel || ''}`, product)) continue;
    events.push({
      at: g.checkedAt || '',
      kind: 'task-gate',
      label: `preflight ${g.approved ? 'approved' : 'held'} · score ${g.score} · ${g.riskLevel}`,
      ok: !!g.approved,
      detail: task.slice(0, 160) || undefined,
    });
  }

  try {
    if (fs.existsSync(MISSION_PLAN_DIR)) {
      const plans = fs.readdirSync(MISSION_PLAN_DIR).filter(f => f.endsWith('.md')).sort().slice(-10);
      if (plans.length) sources.push('mission plans');
      for (const f of plans) {
        if (!matches(f, product)) continue;
        events.push({ at: `${f.slice(0, 10)}T00:00:00.000Z`, kind: 'mission-plan', label: `mission plan: ${f}`, detail: `data/mazos/mission-plans/${f}` });
      }
    }
  } catch { /* mission plans are optional evidence */ }

  const loopRuns = readJsonl(LOOP_RUNS, 40);
  if (loopRuns.length) sources.push('loop events');
  for (const l of loopRuns) {
    const text = `${l.loopId || ''} ${l.summary || ''}`;
    if (!matches(text, product)) continue;
    events.push({ at: l.at || l.timestamp || '', kind: 'loop', label: `loop ${l.type || 'event'}: ${l.loopId || ''}`, detail: l.summary || undefined });
  }

  const receipts = readLoopReceipts(40);
  if (receipts.length) sources.push('loop receipts');
  for (const receipt of receipts) {
    const text = `${receipt.loopId} ${receipt.loopName} ${receipt.goal} ${receipt.evidence.join(' ')}`;
    if (!matches(text, product)) continue;
    events.push({
      at: receipt.createdAt,
      kind: 'receipt',
      label: `receipt ${receipt.status}: ${receipt.loopName}`,
      ok: receipt.status === 'completed' ? true : receipt.status === 'stopped' ? false : undefined,
      detail: receipt.evidence[0] || receipt.nextRunSuggestion,
    });
  }

  events.sort((a, b) => b.at.localeCompare(a.at));

  const notVerified: string[] = [];
  if (!events.some(e => e.kind === 'run')) notVerified.push('No validation runs logged for this item — nothing has been proven by a check.');
  if (!events.some(e => e.kind === 'task-gate')) notVerified.push('No task-gate preflight logged — this work was not scored before launch.');

  return { itemId, product, events: events.slice(0, 20), sources, notVerified };
}
