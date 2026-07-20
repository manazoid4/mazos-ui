// Loop Engineering deck: Ralph-style loop definitions with hard stop conditions,
// budgets, no-progress detection, and human gates. MAZos never executes loops —
// it generates the runner prompt and tracks evidence the human/agent reports back.
// Pure module — client-safe. Persistence lives in the /api/mazos/loops route.

import { SAFETY_LEVELS, type SafetyLevel } from './safety';
import { forbiddenFor } from './handoff';

export type LoopAgent = 'Hermes' | 'Codex' | 'Claude';

export type LoopAutonomy = 'suggest' | 'diff' | 'branch';

export type LoopDef = {
  id: string;
  name: string;
  goal: string;
  promptTemplate: string;      // the task repeated every iteration (BUILD pass)
  successCondition: string;    // completion promise — stop when true
  maxIterations: number;
  budgetMinutes: number;
  noProgressStop: number;      // halt after N iterations with no measurable change
  humanGates: string[];        // actions that must stop and ask
  safetyCeiling: SafetyLevel;
  agent: LoopAgent;
  // v2 loop-cockpit fields (optional so legacy custom loops keep loading)
  repo?: string;               // PATHS key of the target repo — where .loops/<id>/ lives
  verifyActionIds?: string[];  // registered commandRegistry actions; the mechanical gate
  autonomy?: LoopAutonomy;     // ceiling: no verify action ⇒ permanently 'suggest'
  promptVersion?: number;      // bump on every rule added after a misbehavior
};

export type LoopEventType = 'start' | 'iteration' | 'complete' | 'stop' | 'gate';
export type LoopStopReason = 'done' | 'no-progress' | 'budget' | 'manual';
export type LoopEvent = { loopId: string; at: string; type: LoopEventType; summary?: string; reason?: LoopStopReason };

export type LoopStatus = 'idle' | 'running' | 'gated' | 'stopped' | 'complete';
export type LoopState = {
  def: LoopDef;
  status: LoopStatus;
  iteration: number;           // iterations since last start
  startedAt: string | null;
  budgetUsedMinutes: number;
  lastEvent: LoopEvent | null;
  stopReason: LoopStopReason | null;
  // v2: derived from machine receipts — the "march of nines" counters
  successRate: number | null;  // passes / last N run receipts
  trusted: boolean;            // ≥0.8 over ≥5 receipts
  circuitOpen: boolean;        // same failure repeated ≥ noProgressStop times
  receiptCount: number;
};

// Minimal shape foldLoopState needs from a machine receipt (full type in loopReceipts).
export type ReceiptSignal = { loopId: string; at: string; passed: boolean; failureKey: string | null };

export const LOOP_TEMPLATES: LoopDef[] = [
  {
    id: 'daily_triage_l1', name: 'Daily Triage L1', agent: 'Hermes', safetyCeiling: 'L1',
    goal: 'One report-only triage pass per day: max 3 priorities, blocker, next action.',
    promptTemplate: 'Run MAZos Daily Triage in L1 report-only mode. Read STATE.md, LOOP.md, loop-budget.md, 03-MEMORY/PROJECT_INDEX.md, 03-MEMORY/CURRENT_TASKS.md, and relevant 02-PROJECTS CURRENT notes. Inspect git status only. Return max 3 high-priority items, current blocker, one next action, and evidence paths.',
    successCondition: 'Triage report delivered with 3 priorities, blocker, one next action, evidence paths.',
    maxIterations: 1, budgetMinutes: 15, noProgressStop: 1,
    humanGates: ['Editing any file', 'Anything beyond reading files and git status'],
    repo: 'mazos_ui', autonomy: 'suggest', promptVersion: 2,
  },
  {
    id: 'pr_babysitter', name: 'PR Babysitter', agent: 'Codex', safetyCeiling: 'L3',
    goal: 'Watch open PRs and unpushed branches until merged or blocked.',
    promptTemplate: 'Check every open PR and unpushed branch in the priority repos (MAZos UI, Recall, JobFilter, OpenFlowKit). For each: CI status, review state, merge conflicts, unpushed commit count. Fix small CI/lint failures on the PR branch only. Report per-PR: state, what changed this pass, what still blocks merge.',
    successCondition: 'Every open PR is merged, or explicitly blocked with the blocker named and queued for a human decision.',
    maxIterations: 6, budgetMinutes: 60, noProgressStop: 2,
    humanGates: ['Merging any PR', 'Closing a PR', 'Force-push or history rewrite', 'Pushing to main'],
  },
  {
    id: 'build_doctor', name: 'Build Doctor', agent: 'Claude', safetyCeiling: 'L2',
    goal: 'Rebuild until green with minimal diffs.',
    promptTemplate: 'Run the project build (npm run build). If it fails, fix ONLY the reported errors with the smallest possible diff, then rebuild. Paste the exact error and the exact fix each pass.',
    successCondition: 'Build exits 0.',
    maxIterations: 5, budgetMinutes: 30, noProgressStop: 2,
    humanGates: ['Deleting files', 'Changing dependencies or lockfiles', 'Architectural refactors'],
    repo: 'mazos_ui', verifyActionIds: ['verify_mazos'], autonomy: 'diff', promptVersion: 2,
  },
];
// v1 templates intake_drainer and ship_log_updater are gone: the intake queue
// never existed, and the Shipped strip computes the ship log from git directly.

// PLAN pass (Ralph: one prompt never both decides and does): gap analysis only,
// writes .loops/<id>/plan.md in the target repo, no commits.
export function buildPlanPrompt(def: LoopDef): string {
  const spec = SAFETY_LEVELS[def.safetyCeiling];
  return [
    `${def.agent}: PLAN pass for loop "${def.name}" (v${def.promptVersion ?? 1}). Analysis only — no code changes, no commits.`,
    ``,
    `GOAL: ${def.goal}`,
    `SAFETY CEILING: ${spec.level} ${spec.label} — ${spec.meaning}`,
    ``,
    `1. GRILL FIRST: list the 3 assumptions in this goal most likely to be wrong, and verify each against the actual repo before planning. State what you found.`,
    `2. Read .loops/${def.id}/plan.md, .loops/${def.id}/criteria.json, and .loops/${def.id}/progress.md if they exist.`,
    `3. Compare the goal and criteria against the actual current state of the repo. Do not assume something is unimplemented — check.`,
    `4. Rewrite .loops/${def.id}/plan.md as a prioritized checklist of small, one-iteration items. Format each as "- [ ] item (blocks: none)" or "(blocks: #n)" naming items that must finish first. Prefer vertical slices — thin but complete through every layer — over layer-only work. Each item must be objectively checkable.`,
    `5. Do NOT edit criteria.json descriptions or remove items — flipping "passes" happens only via verified build passes.`,
    ``,
    `HUMAN GATES (stop and ask — file in the MAZos Decision strip):`,
    ...def.humanGates.map(g => `  - ${g}`),
    ``,
    `FORBIDDEN:`,
    `  - Any commit, file edit outside .loops/${def.id}/, install, or config change.`,
    ...forbiddenFor(def.safetyCeiling).map(f => `  - ${f}`),
  ].join('\n');
}

// BUILD pass: exactly ONE plan item, implement, verify, commit. Ralph-style
// runner prompt: same task every iteration + completion promise + hard stops.
export function buildLoopPrompt(def: LoopDef): string {
  const spec = SAFETY_LEVELS[def.safetyCeiling];
  return [
    `${def.agent}: run this as a loop. Repeat the same task every iteration until the completion promise is true or a stop condition fires.`,
    ``,
    `LOOP: ${def.name}`,
    `GOAL: ${def.goal}`,
    `SAFETY CEILING: ${spec.level} ${spec.label} — ${spec.meaning}`,
    ``,
    `TASK (repeat verbatim each iteration):`,
    def.promptTemplate,
    ...(def.repo ? [
      ``,
      `ITERATION DISCIPLINE:`,
      `  - Pick exactly ONE unchecked item from .loops/${def.id}/plan.md whose "(blocks:)" dependencies are all done. One item per iteration, never more.`,
      `  - Implement it as a vertical slice with the smallest possible diff, run the verify command${(def.verifyActionIds?.length ?? 0) > 1 ? 's' : ''} (${def.verifyActionIds?.join(', ') || 'none registered'}), and commit with a descriptive message.`,
      `  - RATCHET: if this iteration fixed a bug, add a permanent guard (test, lint rule, or check) in the same commit so that bug class cannot recur. Note the guard in progress.md.`,
      `  - Append one line to .loops/${def.id}/progress.md: which item, what changed, verify result.`,
      `  - NEVER edit .loops/${def.id}/criteria.json descriptions or remove items. Tampering renders the iteration failed.`,
    ] : []),
    ``,
    `COMPLETION PROMISE (stop with success only when true):`,
    `  ${def.successCondition}`,
    ``,
    `HARD STOP CONDITIONS:`,
    `  - Max iterations: ${def.maxIterations}. Stop and report if reached without success.`,
    `  - Budget: ${def.budgetMinutes} minutes total. Stop when exceeded.`,
    `  - No-progress: stop after ${def.noProgressStop} iteration(s) with no measurable change.`,
    ``,
    `HUMAN GATES (stop and ask before any of these — file it in the MAZos Decision Inbox):`,
    ...def.humanGates.map(g => `  - ${g}`),
    ``,
    `FORBIDDEN:`,
    ...forbiddenFor(def.safetyCeiling).map(f => `  - ${f}`),
    ``,
    `EACH ITERATION REPORT: iteration number, what changed, evidence paths, exact command output. Never claim unverified progress.`,
  ].join('\n');
}

// Fold the event log + machine receipts into per-loop state. Last start resets
// the iteration counter. Receipts drive the trust counters; a "running" loop
// with zero receipts for >3 days is a zombie and gets auto-stopped in the view.
const ZOMBIE_DAYS = 3;
const TRUST_WINDOW = 10;
export function foldLoopState(defs: LoopDef[], events: LoopEvent[], receipts: ReceiptSignal[] = []): LoopState[] {
  return defs.map(def => {
    const evts = events.filter(e => e.loopId === def.id);
    let status: LoopStatus = 'idle', iteration = 0, startedAt: string | null = null, stopReason: LoopStopReason | null = null;
    for (const e of evts) {
      if (e.type === 'start') { status = 'running'; iteration = 0; startedAt = e.at; stopReason = null; }
      else if (e.type === 'iteration') { iteration++; if (status === 'idle') status = 'running'; }
      else if (e.type === 'gate') status = 'gated';
      else if (e.type === 'complete') status = 'complete';
      else if (e.type === 'stop') { status = 'stopped'; stopReason = e.reason || 'manual'; }
    }
    const lastEvent = evts[evts.length - 1] || null;

    const mine = receipts.filter(r => r.loopId === def.id);
    const window = mine.slice(-TRUST_WINDOW);
    const successRate = window.length ? window.filter(r => r.passed).length / window.length : null;
    const trusted = mine.length >= 5 && successRate !== null && successRate >= 0.8;
    let sameFailure = 0;
    for (let i = mine.length - 1; i >= 0; i--) {
      const r = mine[i];
      if (r.passed || !r.failureKey) break;
      if (sameFailure === 0 || r.failureKey === mine[mine.length - 1].failureKey) sameFailure++;
      else break;
    }
    const circuitOpen = sameFailure >= Math.max(2, def.noProgressStop);

    if ((status === 'running' || status === 'gated') && mine.length === 0 && startedAt
      && Date.now() - Date.parse(startedAt) > ZOMBIE_DAYS * 864e5) {
      status = 'stopped'; stopReason = 'no-progress';
    }

    const end = status === 'running' || status === 'gated' ? Date.now() : lastEvent ? Date.parse(lastEvent.at) : 0;
    const budgetUsedMinutes = startedAt ? Math.max(0, Math.round((end - Date.parse(startedAt)) / 60_000)) : 0;
    return { def, status, iteration, startedAt, budgetUsedMinutes, lastEvent, stopReason, successRate, trusted, circuitOpen, receiptCount: mine.length };
  });
}
