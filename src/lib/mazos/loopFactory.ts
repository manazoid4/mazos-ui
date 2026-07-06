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
  | 'ship-log'
  | 'github-pulse'
  | 'useless-feature-reaper'
  | 'revenue-radar'
  | 'founder-inbox';

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
  audit: LoopUsefulnessAudit;
};

export type LoopUsefulnessDecision = 'keep' | 'revise' | 'merge' | 'remove';

export type LoopUsefulnessAudit = {
  score: number;
  decision: LoopUsefulnessDecision;
  label: string;
  strengths: string[];
  gaps: string[];
  dimensions: {
    trigger: number;
    sourcePolicy: number;
    latestGithub: number;
    evidence: number;
    verifier: number;
    safety: number;
    stopCondition: number;
    productImpact: number;
  };
};

export const LOOP_FACTORY_PATTERNS: { id: Exclude<LoopPatternId, 'auto'>; label: string; description: string }[] = [
  { id: 'research-intelligence', label: 'Research Intelligence', description: 'Turn public market/competitor inputs into ranked product moves.' },
  { id: 'daily-triage', label: 'Daily Triage', description: 'Read state and produce the few priorities that matter now.' },
  { id: 'pr-babysitter', label: 'PR Babysitter', description: 'Watch PRs and branches until merged or explicitly blocked.' },
  { id: 'build-doctor', label: 'Build Doctor', description: 'Repeat build/lint repair with small scoped fixes.' },
  { id: 'intake-drainer', label: 'Intake Drainer', description: 'Process queued sources one at a time with gates.' },
  { id: 'ship-log', label: 'Ship Log', description: 'Summarize recent shipped work into durable notes.' },
  { id: 'github-pulse', label: 'GitHub Pulse', description: 'Read latest pushes, PRs, issues, releases, and checks before recommending work.' },
  { id: 'useless-feature-reaper', label: 'Useless Feature Reaper', description: 'Find panels, loops, or features with weak evidence, unclear trigger, or low product value.' },
  { id: 'revenue-radar', label: 'Revenue Radar', description: 'Track pricing, funnel, Stripe, onboarding, and lead-quality gaps.' },
  { id: 'founder-inbox', label: 'Founder Inbox', description: 'Turn scattered asks into ranked loops, decisions, and receipts.' },
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
  if (goal.includes('github') || goal.includes('latest push') || goal.includes('latest pushes') || goal.includes('release') || goal.includes('checks')) return 'github-pulse';
  if (goal.includes('useless') || goal.includes('cleanup') || goal.includes('remove') || goal.includes('reaper') || goal.includes('bloat')) return 'useless-feature-reaper';
  if (goal.includes('revenue') || goal.includes('stripe') || goal.includes('pricing') || goal.includes('conversion') || goal.includes('lead quality')) return 'revenue-radar';
  if (goal.includes('inbox') || goal.includes('messages') || goal.includes('scattered') || goal.includes('asks')) return 'founder-inbox';
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

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function dimension(value: boolean, strong = 12, weak = 4) {
  return value ? strong : weak;
}

export function auditLoopUsefulness(def: LoopDef, sources: string[] = []): LoopUsefulnessAudit {
  const text = `${def.id} ${def.name} ${def.goal} ${def.promptTemplate} ${def.successCondition} ${def.humanGates.join(' ')}`.toLowerCase();
  const dimensions = {
    trigger: dimension(hasAny(text, ['daily', 'weekly', 'watch', 'queue', 'pr', 'pull request', 'build', 'ship log', 'intake', 'schedule', 'every']), 12, 3),
    sourcePolicy: Math.min(14, (sources.length ? 8 : 0) + (hasAny(text, ['read ', 'read first', 'source', 'url', 'path', 'git log', 'public', 'bounded']) ? 6 : 0)),
    latestGithub: dimension(hasAny(text, ['github', 'git ', 'git status', 'git log', 'pr', 'pull request', 'branch', 'ci']), 10, 2),
    evidence: dimension(hasAny(text, ['evidence', 'source receipt', 'exact output', 'proof', 'report:', 'where it was filed']), 14, 3),
    verifier: dimension(hasAny(text, ['verify', 'build', 'lint', 'test', 'review', 'ci', 'proof needed']), 12, 3),
    safety: def.safetyCeiling === 'L1' ? 10 : def.safetyCeiling === 'L2' ? 9 : def.safetyCeiling === 'L3' ? 7 : 3,
    stopCondition: Math.min(14, (def.successCondition.trim() ? 5 : 0) + (def.maxIterations <= 10 ? 3 : 0) + (def.budgetMinutes <= 90 ? 3 : 0) + (def.humanGates.length ? 3 : 0)),
    productImpact: dimension(hasAny(text, ['jobfilter', 'recall', 'mazos', 'openflowkit', 'competitor', 'revenue', 'lead', 'ship', 'build', 'pr', 'intake', 'vault']), 14, 4),
  };
  const score = Math.max(0, Math.min(100, Object.values(dimensions).reduce((sum, value) => sum + value, 0)));
  const gaps: string[] = [];
  const strengths: string[] = [];
  if (dimensions.trigger < 8) gaps.push('Trigger is vague; say when this loop should run.');
  else strengths.push('Trigger is concrete enough to schedule or launch manually.');
  if (dimensions.sourcePolicy < 10) gaps.push('Source policy is weak; add bounded URLs, files, or read-first receipts.');
  else strengths.push('Sources are bounded or clearly named.');
  if (dimensions.latestGithub < 7) gaps.push('Latest GitHub/source freshness is not explicit.');
  else strengths.push('Git/GitHub freshness is part of the loop.');
  if (dimensions.evidence < 10) gaps.push('Evidence receipt requirements are weak.');
  else strengths.push('Evidence requirements are visible.');
  if (dimensions.verifier < 8) gaps.push('Verifier is weak; add build, lint, test, review, or proof checks.');
  else strengths.push('Verification path is named.');
  if (dimensions.stopCondition < 10) gaps.push('Stop conditions need tighter budget, iteration, success, or human-gate rules.');
  else strengths.push('Stop conditions are bounded.');
  if (dimensions.productImpact < 10) gaps.push('Product impact is unclear; tie it to a named product or revenue/shipping outcome.');
  else strengths.push('Product impact is clear.');

  const decision: LoopUsefulnessDecision = score >= 82 ? 'keep' : score >= 64 ? 'revise' : score >= 46 ? 'merge' : 'remove';
  const label = decision === 'keep'
    ? 'Useful now'
    : decision === 'revise'
      ? 'Useful after tightening'
      : decision === 'merge'
        ? 'Merge into a stronger loop'
        : 'Remove or rewrite';

  return { score, decision, label, strengths: strengths.slice(0, 4), gaps: gaps.slice(0, 5), dimensions };
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

function draftGithubPulseLoop(goal: string, project: string, sources: string[]): { def: LoopDef; evidenceRequired: string[] } {
  const scopedSources = sources.length ? sources.map((source) => `- ${source}`).join('\n') : '- GitHub repo URL or local git remote for the selected project.';
  return {
    def: {
      id: customLoopId(project, goal),
      name: `${project} GitHub Pulse`,
      agent: 'Codex',
      safetyCeiling: 'L1',
      goal,
      promptTemplate: [
        `Run a GitHub Pulse loop for ${project}.`,
        `Use the latest GitHub state as source of truth before making any recommendation.`,
        `READ FIRST:`,
        scopedSources,
        ``,
        `For each repo or PR found, collect: pushed_at, latest commit, open PRs, failed checks, releases, issues that affect shipping, and unmerged agent branches.`,
        `Return a ranked queue with: what changed recently, what needs action, what can be ignored, and which MAZos loop should handle it next.`,
        `Do not push, merge, close, or edit anything. This is L1 report-only.`,
      ].join('\n'),
      successCondition: `A latest-GitHub snapshot for ${project} is produced with ranked actions and explicit ignore decisions.`,
      maxIterations: 2,
      budgetMinutes: 30,
      noProgressStop: 1,
      humanGates: ['GitHub auth required', 'Private repo access missing', 'Any push/merge/close action', 'Recommendation depends on a failing or missing check'],
    },
    evidenceRequired: ['GitHub repo URL', 'Fetch time', 'pushed_at or latest commit timestamp', 'PR/check/issue links used', 'Ranked next action or ignore reason'],
  };
}

function draftUselessFeatureReaperLoop(goal: string, project: string, sources: string[]): { def: LoopDef; evidenceRequired: string[] } {
  const scopedSources = sources.length ? sources.map((source) => `- ${source}`).join('\n') : '- Current MAZos UI files, research reports, and Loop Doctor output.';
  return {
    def: {
      id: customLoopId(project, goal),
      name: `${project} Useless Feature Reaper`,
      agent: 'Codex',
      safetyCeiling: 'L1',
      goal,
      promptTemplate: [
        `Run a Useless Feature Reaper loop for ${project}.`,
        `READ FIRST:`,
        scopedSources,
        ``,
        `Score each candidate panel, route, loop, or feature on: clear trigger, source freshness, evidence, verifier, human gate, product impact, and repeated user value.`,
        `Return four buckets: keep, revise, merge, remove.`,
        `For remove/merge candidates, include the exact user harm, what replaces it, and what proof would change the decision.`,
        `Do not delete or edit anything. Produce a cleanup plan only.`,
      ].join('\n'),
      successCondition: `A keep/revise/merge/remove cleanup plan exists for ${project} with evidence and replacement paths.`,
      maxIterations: 2,
      budgetMinutes: 35,
      noProgressStop: 1,
      humanGates: ['Deleting code or files', 'Removing a user-visible route', 'Changing navigation', 'Removing a feature with active evidence'],
    },
    evidenceRequired: ['File or route inspected', 'Why it is useful or not useful', 'User/value impact', 'Replacement or merge target', 'Proof needed before removal'],
  };
}

function draftRevenueRadarLoop(goal: string, project: string, sources: string[]): { def: LoopDef; evidenceRequired: string[] } {
  const scopedSources = sources.length ? sources.map((source) => `- ${source}`).join('\n') : '- Pricing page, Stripe setup notes, onboarding path, lead scoring, and competitor pricing sources.';
  return {
    def: {
      id: customLoopId(project, goal),
      name: `${project} Revenue Radar`,
      agent: 'Hermes',
      safetyCeiling: 'L1',
      goal,
      promptTemplate: [
        `Run a Revenue Radar loop for ${project}.`,
        `READ FIRST:`,
        scopedSources,
        ``,
        `Find revenue blockers across pricing, onboarding, payment setup, lead quality, conversion copy, trust signals, and competitor positioning.`,
        `Return: top blocker, expected revenue impact, evidence, proof needed, and one safest next product move.`,
        `Do not change Stripe, env vars, payment links, or customer data.`,
      ].join('\n'),
      successCondition: `One revenue-facing blocker is ranked for ${project} with evidence, proof needed, and a safe next move.`,
      maxIterations: 2,
      budgetMinutes: 30,
      noProgressStop: 1,
      humanGates: ['Stripe/payment change', 'Pricing change', 'Customer outreach', 'Any production env var or database change'],
    },
    evidenceRequired: ['Pricing or funnel source', 'Observed blocker', 'Revenue hypothesis', 'Proof needed', 'Safe next action'],
  };
}

function draftFounderInboxLoop(goal: string, project: string, sources: string[]): { def: LoopDef; evidenceRequired: string[] } {
  const scopedSources = sources.length ? sources.map((source) => `- ${source}`).join('\n') : '- User messages, notes, vault session notes, and MAZos feed items.';
  return {
    def: {
      id: customLoopId(project, goal),
      name: `${project} Founder Inbox`,
      agent: 'Hermes',
      safetyCeiling: 'L1',
      goal,
      promptTemplate: [
        `Run a Founder Inbox loop for ${project}.`,
        `READ FIRST:`,
        scopedSources,
        ``,
        `Turn scattered asks into a ranked operating queue. For each item, classify it as decision, research, code PR, cleanup, revenue, or park.`,
        `Return max 7 items with source, why it matters, loop to run next, and what should be ignored.`,
        `Do not send messages, create reminders, or mutate external systems.`,
      ].join('\n'),
      successCondition: `A ranked queue of founder asks exists with loop assignments and ignore/park decisions.`,
      maxIterations: 1,
      budgetMinutes: 20,
      noProgressStop: 1,
      humanGates: ['Sending a reply', 'Creating external reminders', 'Accessing private inbox content not explicitly provided', 'Making a commitment on behalf of the founder'],
    },
    evidenceRequired: ['Source message or note', 'Classified action type', 'Why it matters', 'Assigned loop', 'Park/ignore reason when applicable'],
  };
}

function draftOperationalLoop(pattern: Exclude<LoopPatternId, 'auto' | 'research-intelligence' | 'github-pulse' | 'useless-feature-reaper' | 'revenue-radar' | 'founder-inbox'>, goal: string, project: string, sources: string[]): { def: LoopDef; evidenceRequired: string[] } {
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
    : pattern === 'github-pulse'
      ? draftGithubPulseLoop(goal, project, sources)
      : pattern === 'useless-feature-reaper'
        ? draftUselessFeatureReaperLoop(goal, project, sources)
        : pattern === 'revenue-radar'
          ? draftRevenueRadarLoop(goal, project, sources)
          : pattern === 'founder-inbox'
            ? draftFounderInboxLoop(goal, project, sources)
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
    audit: auditLoopUsefulness(draft.def, sources),
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
