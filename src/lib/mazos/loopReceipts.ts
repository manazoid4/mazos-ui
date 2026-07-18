import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { LOOP_RECEIPTS, PATHS } from './paths';
import type { LoopDef, LoopEvent, ReceiptSignal } from './loopEngine';
import { runAction } from './commandRegistry';

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

// ---------------------------------------------------------------------------
// v2 machine receipts: filled by MAZos running the loop's verify action + git
// inspection — never hand-typed. You cannot click your way to a completed loop.
// ---------------------------------------------------------------------------

export type CriteriaItem = { id: string; desc: string; passes: boolean };

export type LoopRunReceipt = {
  kind: 'run';
  loopId: string;
  at: string;
  iteration: number;
  verify: { actionId: string; exitCode: number | null; passed: boolean; tail: string }[];
  commitRange: { from: string | null; to: string; count: number } | null;
  diffStat: { files: number; insertions: number; deletions: number } | null;
  criteriaHash: string | null;      // sha256 of [{id,desc}] — passes excluded
  criteriaTampered: boolean;        // desc-hash changed vs previous receipt
  criteriaFlipped: string[];        // ids newly passes:true since previous receipt
  criteriaAllPass: boolean;
  outcome: 'pass' | 'fail';
  note: string;
};

export function repoPathFor(def: LoopDef): string | null {
  if (!def.repo) return null;
  const p = (PATHS as Record<string, string>)[def.repo];
  return p && fs.existsSync(p) ? p : null;
}

export function loopDir(def: LoopDef): string | null {
  const repo = repoPathFor(def);
  return repo ? path.join(repo, '.loops', def.id) : null;
}

export function readCriteria(def: LoopDef): CriteriaItem[] | null {
  const dir = loopDir(def);
  if (!dir) return null;
  const file = path.join(dir, 'criteria.json');
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? parsed.filter((c: any) => c?.id && typeof c.passes === 'boolean') : null;
  } catch { return null; }
}

// Hash covers ids+descriptions only — flipping `passes` is legitimate, editing
// descriptions or removing items is tampering.
function criteriaDescHash(criteria: CriteriaItem[]): string {
  const canonical = JSON.stringify(criteria.map(c => ({ id: c.id, desc: c.desc })).sort((a, b) => a.id.localeCompare(b.id)));
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function git(repo: string, args: string[]): string {
  try { return execFileSync('git', args, { cwd: repo, encoding: 'utf8', timeout: 15_000 }).trim(); }
  catch { return ''; }
}

export function readRunReceipts(loopId?: string, limit = 100): LoopRunReceipt[] {
  const all = readJsonl(LOOP_RECEIPTS, 1000).filter((r) => r.kind === 'run') as LoopRunReceipt[];
  const mine = loopId ? all.filter(r => r.loopId === loopId) : all;
  return mine.slice(-limit);
}

export function receiptSignals(): ReceiptSignal[] {
  return readRunReceipts(undefined, 1000).map(r => ({
    loopId: r.loopId,
    at: r.at,
    passed: r.outcome === 'pass',
    failureKey: r.outcome === 'pass' ? null : (r.verify.find(v => !v.passed)?.tail.slice(0, 120) || 'fail'),
  }));
}

export async function captureLoopRunReceipt(def: LoopDef, note: string): Promise<LoopRunReceipt> {
  const at = new Date().toISOString();
  const prev = readRunReceipts(def.id, 1).at(-1) || null;

  // 1. Run the registered verify actions (allowlisted commands only — same
  //    trust surface as the Action buttons, no new exec capability).
  const verify: LoopRunReceipt['verify'] = [];
  for (const actionId of def.verifyActionIds || []) {
    const run = await runAction(actionId);
    verify.push({
      actionId,
      exitCode: run.exitCode,
      passed: run.success,
      tail: (run.stderr || run.stdout || '').split('\n').filter(Boolean).slice(-5).join('\n').slice(0, 800),
    });
  }
  const verifyPassed = verify.length > 0 && verify.every(v => v.passed);

  // 2. Git evidence on the target repo: commits since the previous receipt
  //    (git log -1 alone would credit unrelated work to the loop).
  const repo = repoPathFor(def);
  let commitRange: LoopRunReceipt['commitRange'] = null;
  let diffStat: LoopRunReceipt['diffStat'] = null;
  if (repo) {
    const head = git(repo, ['log', '-1', '--format=%h']);
    if (head) {
      const from = prev?.commitRange?.to || null;
      const range = from && from !== head ? `${from}..HEAD` : head;
      const count = from && from !== head ? Number(git(repo, ['rev-list', '--count', `${from}..HEAD`]) || '0') : 0;
      commitRange = { from, to: head, count };
      const stat = from && from !== head ? git(repo, ['diff', '--shortstat', from, 'HEAD']) : '';
      const m = stat.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
      if (m) diffStat = { files: Number(m[1]), insertions: Number(m[2] || 0), deletions: Number(m[3] || 0) };
    }
  }

  // 3. Criteria: flips are earned only when verify passed; desc edits = tamper.
  const criteria = readCriteria(def);
  const criteriaHash = criteria ? criteriaDescHash(criteria) : null;
  const criteriaTampered = !!(prev?.criteriaHash && criteriaHash && prev.criteriaHash !== criteriaHash);
  const prevPassing = new Set((prev as any)?.passingIds as string[] | undefined || []);
  const criteriaFlipped = (criteria || []).filter(c => c.passes && !prevPassing.has(c.id)).map(c => c.id);
  const criteriaAllPass = !!criteria && criteria.length > 0 && criteria.every(c => c.passes);

  const receipt: LoopRunReceipt & { passingIds: string[] } = {
    kind: 'run', loopId: def.id, at,
    iteration: (prev ? readRunReceipts(def.id, 1000).length : 0) + 1,
    verify, commitRange, diffStat,
    criteriaHash, criteriaTampered, criteriaFlipped, criteriaAllPass,
    outcome: verifyPassed && !criteriaTampered ? 'pass' : 'fail',
    note: note.slice(0, 300),
    passingIds: (criteria || []).filter(c => c.passes).map(c => c.id),
  };

  fs.mkdirSync(path.dirname(LOOP_RECEIPTS), { recursive: true });
  fs.appendFileSync(LOOP_RECEIPTS, `${JSON.stringify(receipt)}\n`, 'utf8');
  return receipt;
}

export function readLoopReceipts(limit = 80, loopId?: string): LoopReceipt[] {
  const receipts = readJsonl(LOOP_RECEIPTS, Math.max(limit, 200)).filter((r) => r.kind !== 'run') as LoopReceipt[];
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
