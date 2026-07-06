import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CUSTOM_LOOPS } from './paths';
import { LOOP_TEMPLATES, type LoopAgent, type LoopDef } from './loopEngine';
import type { SafetyLevel } from './safety';

export type LoopPatternId =
  | 'auto'
  | 'research-intelligence'
  | 'daily-triage'
  | 'pr-babysitter'
  | 'build-doctor'
  | 'intake-drainer'
  | 'ship-log';

export type LoopFactoryInput = {
  goal: string;
  project?: string;
  pattern?: LoopPatternId;
  sources?: string[];
};

export type LoopReadiness = 'ready' | 'needs-review' | 'unsafe';

export type LoopReadinessInput = {
  goal: string;
  sources: string[];
  successCondition: string;
  humanGates: string[];
  evidenceRequired: string[];
  maxIterations: number;
  budgetMinutes: number;
  safetyCeiling: SafetyLevel;
  pattern: Exclude<LoopPatternId, 'auto'>;
};

export type LoopReadinessResult = {
  score: number;
  readiness: LoopReadiness;
  warnings: string[];
};

export type LoopFactoryDraft = {
  pattern: Exclude<LoopPatternId, 'auto'>;
  def: LoopDef;
  readinessScore: number;
  readiness: LoopReadiness;
  warnings: string[];
  evidenceRequired: string[];
};

export const LOOP_FACTORY_PATTERNS: { id: Exclude<LoopPatternId, 'auto'>; label: string; description: string }[] = [
  { id: 'research-intelligence', label: 'Research Intelligence', description: 'Turn public market/competitor inputs into ranked product moves.' },
  { id: 'daily-triage', label: 'Daily Triage', description: 'Read state and produce the few priorities that matter now.' },
  { id: 'pr-babysitter', label: 'PR Babysitter', description: 'Watch PRs and branches until merged or explicitly blocked.' },
  { id: 'build-doctor', label: 'Build Doctor', description: 'Repeat build/lint repair with small scoped fixes.' },
  { id: 'intake-drainer', label: 'Intake Drainer', description: 'Process queued sources one at a time with gates.' },
  { id: 'ship-log', label: 'Ship Log', description: 'Summarize recent shipped work into durable notes.' },
];

const RESEARCH_MATCHES = ['competitor', 'market', 'research', 'emulate', 'copy', 'pricing', 'positioning', 'landing page', 'funnel', 'alternative'];

function cleanText(value: string, fallback: string) {
  const text = value.replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function cleanSources(sources?: string[]) {
  return (sources || []).map((source) => source.trim()).filter(Boolean).slice(0, 12);
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48) || 'loop';
}

export function customLoopId(project: string | undefined, goal: string) {
  const hash = crypto.createHash('sha1').update(`${project || 'mazos'}|${goal}`).digest('hex').slice(0, 8);
  return `custom_${slug(project || 'mazos')}_${slug(goal)}_${hash}`.slice(0, 80);
}

function classifyPattern(input: LoopFactoryInput): Exclude<LoopPatternId, 'auto'> {
  if (input.pattern && input.pattern !== 'auto') return input.pattern;
  const goal = input.goal.toLowerCase();
  if (RESEARCH_MATCHES.some((term) => goal.includes(term))) return 'research-intelligence';
  if (goal.includes('pr') || goal.includes('pull request') || goal.includes('branch')) return 'pr-babysitter';
  if (goal.includes('build') || goal.includes('lint') || goal.includes('ci')) return 'build-doctor';
  if (goal.includes('intake') || goal.includes('queue') || goal.includes('source')) return 'intake-drainer';
  if (goal.includes('ship log') || goal.includes('changelog') || goal.includes('release')) return 'ship-log';
  return 'daily-triage';
}

export function scoreLoopReadiness(input: LoopReadinessInput): LoopReadinessResult {
  const warnings: string[] = [];
  let score = 100;

  if (!input.goal.trim()) { score -= 35; warnings.push('Goal is empty.'); }
  if (!input.sources.length) { score -= 15; warnings.push('No bounded sources are listed.'); }
  if (!input.successCondition.trim()) { score -= 15; warnings.push('Success condition is missing.'); }
  if (!input.humanGates.length) { score -= 15; warnings.push('Human gates are missing.'); }
  if (!input.evidenceRequired.length) { score -= 10; warnings.push('Evidence requirements are missing.'); }
  if (input.maxIterations > 10) { score -= 10; warnings.push('Max iterations is too high for a reusable loop.'); }
  if (input.budgetMinutes > 120) { score -= 10; warnings.push('Budget is too large for a first saved loop.'); }
  if (input.pattern === 'research-intelligence' && (input.safetyCeiling === 'L3' || input.safetyCeiling === 'L4' || input.safetyCeiling === 'L5')) {
    score -= 10;
    warnings.push('Research loops should start at L1/L2 until evidence quality is proven.');
  }

  const clamped = Math.max(0, Math.min(100, score));
  return {
    score: clamped,
    readiness: clamped >= 80 ? 'ready' : clamped >= 50 ? 'needs-review' : 'unsafe',
    warnings,
  };
}

function draftResearchLoop(goal: string, project: string, sources: string[]): { def: LoopDef; evidenceRequired: string[] } {
  const sourceLines = sources.length ? sources.map((source) => `- ${source}`).join('\n') : '- User-provided URLs or intake queue entries.';
  return {
    def: {
      id: customLoopId(project, goal),
      name: `${project} Competitor Intelligence`,
      agent: 'Hermes',
      safetyCeiling: 'L1',
      goal,
      promptTemplate: [
        `Run a competitor intelligence loop for ${project}.`,
        `Read only these public/bounded sources:`,
        sourceLines,
        `Also read the ${project} playbook/context receipts if MAZos provides them.`,
        `For this iteration, return:`,
        `1. Ideas to steal because they clearly improve conversion, trust, lead quality, or positioning.`,
        `2. Ideas to reject because they are bloat, generic SaaS filler, or outside the current wedge.`,
        `3. One ranked product move for ${project}, with why it beats the current state.`,
        `4. Source receipts: URL/path, observed claim, confidence, and freshness.`,
        `5. Proof needed before acting.`,
        `Do not scrape private/authed content, bypass ToS, crawl broadly, or publish externally.`,
      ].join('\n'),
      successCondition: `One ranked product move for ${project} is produced with source receipts, proof needed, and a clear next action.`,
      maxIterations: 3,
      budgetMinutes: 45,
      noProgressStop: 2,
      humanGates: ['Auth wall or ToS boundary', 'Private scraping or login required', 'Paid source/API required', 'External publishing or outreach', 'Recommendation contradicts the product playbook'],
    },
    evidenceRequired: ['Public source URL or local intake path', 'Observed competitor claim or workflow', 'Why it matters for the selected product', 'Proof needed before implementation'],
  };
}

function draftOperationalLoop(pattern: Exclude<LoopPatternId, 'auto' | 'research-intelligence'>, goal: string, project: string, sources: string[]): { def: LoopDef; evidenceRequired: string[] } {
  const template = LOOP_TEMPLATES.find((loop) => {
    if (pattern === 'daily-triage') return loop.id === 'daily_triage_l1';
    if (pattern === 'pr-babysitter') return loop.id === 'pr_babysitter';
    if (pattern === 'build-doctor') return loop.id === 'build_doctor';
    if (pattern === 'intake-drainer') return loop.id === 'intake_drainer';
    return loop.id === 'ship_log_updater';
  }) || LOOP_TEMPLATES[0];

  const sourceText = sources.length ? `\n\nREAD FIRST:\n${sources.map((source) => `- ${source}`).join('\n')}` : '';
  return {
    def: {
      ...template,
      id: customLoopId(project, goal),
      name: `${project} ${template.name}`,
      goal,
      promptTemplate: `${template.promptTemplate}${sourceText}`,
    },
    evidenceRequired: ['State file or source path read', 'Iteration summary', 'Exact command output when commands are run', 'Stop/gate reason when not complete'],
  };
}

export function generateLoopDraft(input: LoopFactoryInput): LoopFactoryDraft {
  const project = cleanText(input.project || '', 'MAZos');
  const goal = cleanText(input.goal, `Improve ${project} with a bounded reusable loop.`);
  const sources = cleanSources(input.sources);
  const pattern = classifyPattern({ ...input, goal });
  const draft = pattern === 'research-intelligence'
    ? draftResearchLoop(goal, project, sources)
    : draftOperationalLoop(pattern, goal, project, sources);
  const readiness = scoreLoopReadiness({
    goal,
    sources,
    successCondition: draft.def.successCondition,
    humanGates: draft.def.humanGates,
    evidenceRequired: draft.evidenceRequired,
    maxIterations: draft.def.maxIterations,
    budgetMinutes: draft.def.budgetMinutes,
    safetyCeiling: draft.def.safetyCeiling,
    pattern,
  });

  return {
    pattern,
    def: draft.def,
    readinessScore: readiness.score,
    readiness: readiness.readiness,
    warnings: readiness.warnings,
    evidenceRequired: draft.evidenceRequired,
  };
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
