import fs from 'fs';
import path from 'path';
import { LOOP_RECEIPTS } from './paths';
import type { LoopDef, LoopEvent } from './loopEngine';

export type LoopReceiptStatus = 'started' | 'running' | 'gated' | 'completed' | 'stopped';

export type LoopReceipt = {
  receiptId: string;
  loopId: string;
  loopName: string;
  runId: string;
  status: LoopReceiptStatus;
  createdAt: string;
  safetyCeiling: string;
  agent: string;
  goal: string;
  sourceSnapshot: string[];
  actions: string[];
  evidence: string[];
  verification: string[];
  riskFlags: string[];
  decisionNeeded: string | null;
  nextRunSuggestion: string;
};

function readJsonl(file: string, limit = 200): any[] {
  try {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).slice(-limit)
      .map((line) => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function receiptStatus(event: LoopEvent): LoopReceiptStatus {
  if (event.type === 'start') return 'started';
  if (event.type === 'gate') return 'gated';
  if (event.type === 'complete') return 'completed';
  if (event.type === 'stop') return 'stopped';
  return 'running';
}

function evidenceFrom(event: LoopEvent) {
  const evidence = [event.summary].filter(Boolean) as string[];
  if (event.reason) evidence.push(`Stop reason: ${event.reason}`);
  return evidence;
}

function sourceSnapshot(def: LoopDef) {
  const text = `${def.promptTemplate}\n${def.humanGates.join('\n')}`;
  const urls = text.match(/https?:\/\/[^\s)]+/g) || [];
  const paths = text.split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*]\s+/, ''))
    .filter((line) => /^[A-Z]:\\|^\/|^\.\/|^data\/|^research\/|^src\//i.test(line));
  return Array.from(new Set([...urls, ...paths])).slice(0, 12);
}

export function appendLoopReceipt(def: LoopDef, event: LoopEvent): LoopReceipt {
  const status = receiptStatus(event);
  const receipt: LoopReceipt = {
    receiptId: `lr_${Date.parse(event.at).toString(36)}_${event.loopId}_${event.type}`,
    loopId: event.loopId,
    loopName: def.name,
    runId: `${event.loopId}:${event.at}`,
    status,
    createdAt: event.at,
    safetyCeiling: def.safetyCeiling,
    agent: def.agent,
    goal: def.goal,
    sourceSnapshot: sourceSnapshot(def),
    actions: [`${event.type}: ${def.name}`],
    evidence: evidenceFrom(event),
    verification: event.type === 'complete' ? ['Loop marked complete by operator or agent report. Verify with linked source evidence before acting.'] : [],
    riskFlags: [
      ...(def.safetyCeiling === 'L3' || def.safetyCeiling === 'L4' || def.safetyCeiling === 'L5' ? [`Higher safety ceiling: ${def.safetyCeiling}`] : []),
      ...(event.type === 'gate' ? ['Human gate opened'] : []),
      ...(event.type === 'stop' ? ['Loop stopped before completion'] : []),
    ],
    decisionNeeded: event.type === 'gate' ? event.summary || `${def.name} needs a human decision.` : null,
    nextRunSuggestion: event.type === 'complete'
      ? 'Archive receipt and pick the next loop from Loop Doctor or Research Console.'
      : event.type === 'stop'
        ? 'Review stop reason, tighten sources/gates, then rerun only if still useful.'
        : event.type === 'gate'
          ? 'Resolve the Decision Inbox gate before continuing.'
          : 'Log the next iteration with evidence or stop when no progress is made.',
  };

  fs.mkdirSync(path.dirname(LOOP_RECEIPTS), { recursive: true });
  fs.appendFileSync(LOOP_RECEIPTS, `${JSON.stringify(receipt)}\n`, 'utf8');
  return receipt;
}

export function readLoopReceipts(limit = 80, loopId?: string): LoopReceipt[] {
  const receipts = readJsonl(LOOP_RECEIPTS, Math.max(limit, 200)) as LoopReceipt[];
  const filtered = loopId ? receipts.filter((receipt) => receipt.loopId === loopId) : receipts;
  return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export function receiptSummary(loopId: string) {
  const receipts = readLoopReceipts(20, loopId);
  const latest = receipts[0] || null;
  return {
    count: receipts.length,
    latestStatus: latest?.status || null,
    latestAt: latest?.createdAt || null,
    latestEvidence: latest?.evidence?.[0] || null,
  };
}
