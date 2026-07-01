// Loop Engineering deck: Ralph-style loop definitions with hard stop conditions,
// budgets, no-progress detection, and human gates. MAZos never executes loops —
// it generates the runner prompt and tracks evidence the human/agent reports back.
// Pure module — client-safe. Persistence lives in the /api/mazos/loops route.

import { SAFETY_LEVELS, type SafetyLevel } from './safety';
import { forbiddenFor } from './handoff';

export type LoopAgent = 'Hermes' | 'Codex' | 'Claude';

export type LoopDef = {
  id: string;
  name: string;
  goal: string;
  promptTemplate: string;      // the task repeated every iteration
  successCondition: string;    // completion promise — stop when true
  maxIterations: number;
  budgetMinutes: number;
  noProgressStop: number;      // halt after N iterations with no measurable change
  humanGates: string[];        // actions that must stop and ask
  safetyCeiling: SafetyLevel;
  agent: LoopAgent;
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
};

export const LOOP_TEMPLATES: LoopDef[] = [
  {
    id: 'daily_triage_l1', name: 'Daily Triage L1', agent: 'Hermes', safetyCeiling: 'L1',
    goal: 'One report-only triage pass per day: max 3 priorities, blocker, next action.',
    promptTemplate: 'Run MAZos Daily Triage in L1 report-only mode. Read STATE.md, LOOP.md, loop-budget.md, 03-MEMORY/PROJECT_INDEX.md, 03-MEMORY/CURRENT_TASKS.md, and relevant 02-PROJECTS CURRENT notes. Inspect git status only. Return max 3 high-priority items, current blocker, one next action, and evidence paths.',
    successCondition: 'Triage report delivered with 3 priorities, blocker, one next action, evidence paths.',
    maxIterations: 1, budgetMinutes: 15, noProgressStop: 1,
    humanGates: ['Editing any file', 'Anything beyond reading files and git status'],
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
  },
  {
    id: 'intake_drainer', name: 'Intake Queue Drainer', agent: 'Hermes', safetyCeiling: 'L2',
    goal: 'Process ingest-queue.jsonl until empty.',
    promptTemplate: 'Read data/mazos/ingest-queue.jsonl. Process the oldest unprocessed source into Recall/Obsidian, preserving tags, notes, and source URL. One source per iteration. Report: source processed, where it was filed, failures.',
    successCondition: 'Queue empty: every entry processed or explicitly parked with a reason.',
    maxIterations: 10, budgetMinutes: 45, noProgressStop: 2,
    humanGates: ['Any source requiring login/auth', 'Any ToS-restricted scraping', 'Paid API calls'],
  },
  {
    id: 'ship_log_updater', name: 'Ship Log Updater', agent: 'Hermes', safetyCeiling: 'L2',
    goal: 'Collect what shipped across repos into the ship log.',
    promptTemplate: 'Read git log for the last 7 days in each priority repo. Group commits per day per project into a short "what shipped" markdown update. Write it to the ship log and paste it.',
    successCondition: 'Ship log written covering all priority repos for the last 7 days.',
    maxIterations: 2, budgetMinutes: 20, noProgressStop: 1,
    humanGates: ['Publishing anywhere external (GitHub release, newsletter, social)'],
  },
];

// Ralph-style runner prompt: same task every iteration + completion promise + hard stops.
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

// Fold the event log into per-loop state. Last start resets the iteration counter.
export function foldLoopState(defs: LoopDef[], events: LoopEvent[]): LoopState[] {
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
    const end = status === 'running' || status === 'gated' ? Date.now() : lastEvent ? Date.parse(lastEvent.at) : 0;
    const budgetUsedMinutes = startedAt ? Math.max(0, Math.round((end - Date.parse(startedAt)) / 60_000)) : 0;
    return { def, status, iteration, startedAt, budgetUsedMinutes, lastEvent, stopReason };
  });
}
