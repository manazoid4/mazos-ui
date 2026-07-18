// Loop Factory v2: goal + repo + verify action → a gated Loop draft.
// The 11-pattern picker and Loop Doctor keyword ceremony are gone — the gate
// is taskScoring (same preflight the old Task Gate page used), and the only
// hard rule is Karpathy #1/#8: no verify action, no saveable loop.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CUSTOM_LOOPS, PATHS } from './paths';
import { LOOP_TEMPLATES, type LoopAgent, type LoopDef } from './loopEngine';
import { scoreTask, type TaskGateOutput } from './taskScoring';

export type LoopFactoryInput = {
  goal: string;
  repo: string;                // PATHS key, e.g. 'jobfilter', 'flowlens', 'mazos_ui'
  verifyActionId?: string;     // registered commandRegistry action (e.g. 'verify_jobfilter')
  agent?: LoopAgent;
};

export type LoopFactoryDraft = {
  def: LoopDef;
  gate: Pick<TaskGateOutput, 'approved' | 'score' | 'riskLevel' | 'blockers' | 'warnings' | 'missingInfo'>;
};

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48) || 'loop';
}

export function customLoopId(project: string | undefined, goal: string) {
  const hash = crypto.createHash('sha1').update(`${project || 'mazos'}|${goal}`).digest('hex').slice(0, 8);
  return `custom_${slug(project || 'mazos')}_${slug(goal)}_${hash}`.slice(0, 80);
}

export function repoKeyPath(repoKey: string): string | null {
  const p = (PATHS as Record<string, string>)[repoKey];
  return p && fs.existsSync(p) ? p : null;
}

export function generateLoopDraft(input: LoopFactoryInput): LoopFactoryDraft {
  const goal = input.goal.replace(/\s+/g, ' ').trim();
  const repoPath = repoKeyPath(input.repo);
  const verifyActionIds = input.verifyActionId ? [input.verifyActionId] : [];
  const id = customLoopId(input.repo, goal);

  const def: LoopDef = {
    id,
    name: goal.length > 60 ? `${goal.slice(0, 57)}…` : goal || 'Unnamed loop',
    goal,
    agent: input.agent || 'Claude',
    safetyCeiling: 'L2',
    repo: input.repo,
    verifyActionIds,
    autonomy: verifyActionIds.length ? 'branch' : 'suggest', // verifier strength sets the ceiling
    promptVersion: 1,
    promptTemplate: [
      `Work the loop "${goal}" in ${repoPath || input.repo}.`,
      `Read .loops/${id}/plan.md and pick exactly ONE unchecked item.`,
      `Implement it with the smallest possible diff. Run the verify command. Commit.`,
    ].join('\n'),
    successCondition: `Every item in .loops/${id}/criteria.json has passes:true, proven by a passing verify receipt.`,
    maxIterations: 10,
    budgetMinutes: 0,          // wall-clock budgets are theatre for copy-paste loops; iterations only
    noProgressStop: 2,
    humanGates: ['Deleting files outside the plan item', 'Dependency or lockfile changes', 'Any push to main', 'Anything credential-shaped'],
  };

  const gate = scoreTask({
    repoPath: repoPath || undefined,
    repoLabel: input.repo,
    task: goal,
    successCriteria: def.successCondition,
    agent: def.agent,
    mode: 'build/lint',
    expectedFiles: `.loops/${id}/plan.md`,
    runBuild: verifyActionIds.length > 0,
  });

  const blockers = [...gate.blockers];
  if (!verifyActionIds.length) blockers.push('No verify action registered — a loop without a mechanical gate is a slop machine. Pick one (e.g. verify_mazos).');
  if (!repoPath) blockers.push(`Repo key "${input.repo}" does not resolve to an existing path.`);

  return {
    def,
    gate: { approved: blockers.length === 0 && gate.approved, score: gate.score, riskLevel: blockers.length ? 'danger' : gate.riskLevel, blockers, warnings: gate.warnings, missingInfo: gate.missingInfo },
  };
}

// Init-once (Anthropic pattern): scaffold the loop's filesystem memory in the
// target repo. Iterations re-hydrate from these files, never from a session.
export function scaffoldLoopFiles(def: LoopDef) {
  const repoPath = def.repo ? repoKeyPath(def.repo) : null;
  if (!repoPath) return null;
  const dir = path.join(repoPath, '.loops', def.id);
  fs.mkdirSync(dir, { recursive: true });
  const planFile = path.join(dir, 'plan.md');
  const criteriaFile = path.join(dir, 'criteria.json');
  const progressFile = path.join(dir, 'progress.md');
  if (!fs.existsSync(planFile)) fs.writeFileSync(planFile, `# Plan — ${def.name}\n\nGoal: ${def.goal}\n\n- [ ] (PLAN pass fills this in)\n`, 'utf8');
  if (!fs.existsSync(criteriaFile)) fs.writeFileSync(criteriaFile, JSON.stringify([{ id: 'c1', desc: def.goal, passes: false }], null, 2), 'utf8');
  if (!fs.existsSync(progressFile)) fs.writeFileSync(progressFile, `# Progress — ${def.name}\n`, 'utf8');
  return dir;
}

export function readCustomLoops(): LoopDef[] {
  if (!fs.existsSync(CUSTOM_LOOPS)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(CUSTOM_LOOPS, 'utf8')) as { loops?: LoopDef[] };
    return Array.isArray(parsed.loops) ? parsed.loops.filter((loop) => loop?.id && loop?.name && loop?.promptTemplate) : [];
  } catch {
    return [];
  }
}

export function saveCustomLoop(def: LoopDef) {
  const current = readCustomLoops().filter((loop) => loop.id !== def.id);
  const loops = [...current, def].sort((a, b) => a.name.localeCompare(b.name));
  fs.mkdirSync(path.dirname(CUSTOM_LOOPS), { recursive: true });
  fs.writeFileSync(CUSTOM_LOOPS, JSON.stringify({ updatedAt: new Date().toISOString(), loops }, null, 2), 'utf8');
  scaffoldLoopFiles(def);
  return loops;
}

export function allLoopTemplates() {
  const seen = new Set<string>();
  return [...LOOP_TEMPLATES, ...readCustomLoops()].filter((loop) => {
    if (seen.has(loop.id)) return false;
    seen.add(loop.id);
    return true;
  });
}
