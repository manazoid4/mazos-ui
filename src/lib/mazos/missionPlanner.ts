import fs from 'fs';
import path from 'path';
import { DATA_DIR, today } from './paths';
import { scoreTask, type TaskGateInput } from './taskScoring';
import { buildContextMap, type SourceReceipt } from './sourceReceipts';

export const MISSION_PLAN_DIR = path.join(DATA_DIR, 'mission-plans');

export type MissionPlan = {
  id: string;
  createdAt: string;
  mission: string;
  repo: { label: string; path: string };
  agentMode: string;
  likelyFiles: string[];
  successCriteria: string[];
  forbiddenActions: string[];
  validationCommands: string[];
  hermesPrompt: string;
  sourceReceipts: SourceReceipt[];
  contextPrompt: string;
  fallbackPlan: string[];
  handoffTemplate: string;
  score: number;
  riskLevel: string;
  savedTo: string;
};

export function createMissionPlan(input: TaskGateInput): MissionPlan {
  const gate = scoreTask(input);
  const repo = gate.repo || {
    label: input.repoLabel || 'Selected repo',
    path: input.repoPath || '',
    exists: false,
    branch: 'n/a',
    dirty: false,
    buildScript: false,
    lintScript: false,
  };
  const likelyFiles = splitLines(input.expectedFiles).length
    ? splitLines(input.expectedFiles)
    : inferLikelyFiles(input.task || '', repo.label);
  const contextMap = buildContextMap(repo.label || input.repoLabel || 'MAZos');
  const id = `mission-${Date.now()}`;
  const savedTo = path.join(MISSION_PLAN_DIR, `${today()}-${safeName(repo.label)}-${id}.md`);
  const plan: MissionPlan = {
    id,
    createdAt: new Date().toISOString(),
    mission: oneLineMission(input.task || `Improve ${repo.label}`),
    repo: { label: repo.label, path: repo.path },
    agentMode: gate.recommendedAgentMode,
    likelyFiles,
    successCriteria: gate.successChecklist,
    forbiddenActions: gate.forbiddenActions,
    validationCommands: gate.validationCommands,
    hermesPrompt: withContextReceipts(gate.suggestedPrompt, contextMap),
    sourceReceipts: contextMap.receipts,
    contextPrompt: contextMap.copyPrompt,
    fallbackPlan: [
      'Stop if repo state differs from the Task Gate result.',
      'If validation fails, capture exact error output and generate a smaller fix prompt.',
      'If scope expands, write a handoff and ask Maz before continuing.',
    ],
    handoffTemplate: buildHandoffTemplate(input, gate),
    score: gate.score,
    riskLevel: gate.riskLevel,
    savedTo,
  };
  saveMissionPlan(plan);
  return plan;
}

function saveMissionPlan(plan: MissionPlan) {
  fs.mkdirSync(MISSION_PLAN_DIR, { recursive: true });
  const md = [
    `# ${plan.mission}`,
    '',
    `Created: ${plan.createdAt}`,
    `Repo: ${plan.repo.label} - ${plan.repo.path}`,
    `Mode: ${plan.agentMode}`,
    `Score: ${plan.score}`,
    `Risk: ${plan.riskLevel}`,
    '',
    '## Likely Files',
    plan.likelyFiles.map((file) => `- ${file}`).join('\n'),
    '',
    '## Success Criteria',
    plan.successCriteria.map((item) => `- ${item}`).join('\n'),
    '',
    '## Forbidden Actions',
    plan.forbiddenActions.map((item) => `- ${item}`).join('\n'),
    '',
    '## Validation Commands',
    plan.validationCommands.map((item) => `- ${item}`).join('\n'),
    '',
    '## Source Receipts',
    plan.sourceReceipts.map((item) => `- [${item.kind}] ${item.title} — ${item.pathOrUrl} (${item.confidence}, ${item.freshness})`).join('\n'),
    '',
    '## Context Prompt',
    '```text',
    plan.contextPrompt,
    '```',
    '',
    '## Hermes Prompt',
    '```text',
    plan.hermesPrompt,
    '```',
    '',
    '## Fallback Plan',
    plan.fallbackPlan.map((item) => `- ${item}`).join('\n'),
    '',
    '## Handoff Template',
    '```markdown',
    plan.handoffTemplate,
    '```',
    '',
  ].join('\n');
  fs.writeFileSync(plan.savedTo, md);
}

function splitLines(value?: string) {
  return (value || '').split(/\n|,/).map((line) => line.trim()).filter(Boolean);
}

function inferLikelyFiles(task: string, repoLabel: string) {
  const lower = `${repoLabel} ${task}`.toLowerCase();
  if (lower.includes('mazos') && lower.includes('api')) return ['src/app/api/mazos/*', 'src/lib/mazos/*'];
  if (lower.includes('mazos') && /(ui|panel|dashboard|page)/.test(lower)) return ['src/app/page.tsx', 'src/app/*/page.tsx', 'src/app/globals.css'];
  if (lower.includes('jobfilter')) return ['src/pages/*', 'src/lib/*', 'app/api/*'];
  if (lower.includes('recall')) return ['src/*', 'app/api/*', 'server/*'];
  return ['Inspect repo first; keep edits to the smallest relevant files.'];
}

function oneLineMission(task: string) {
  const normalized = task.replace(/\s+/g, ' ').trim();
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}

function buildHandoffTemplate(input: TaskGateInput, gate: ReturnType<typeof scoreTask>) {
  return [
    '## Mission',
    input.task || '',
    '',
    '## Repo',
    gate.repo?.path || input.repoPath || '',
    '',
    '## What Changed',
    '- ',
    '',
    '## Validation',
    gate.validationCommands.map((command) => `- ${command}: pending`).join('\n'),
    '',
    '## Blockers / Risks',
    '- ',
    '',
    '## Next 3 Actions',
    '1. ',
    '2. ',
    '3. ',
    '',
    '## Resume Prompt',
    gate.suggestedPrompt,
  ].join('\n');
}

function withContextReceipts(prompt: string, contextMap: ReturnType<typeof buildContextMap>) {
  const receipts = contextMap.receipts.filter((item) => item.readFirst).slice(0, 8);
  return [
    prompt,
    '',
    'SOURCE RECEIPTS - READ BEFORE ACTING:',
    ...(receipts.length
      ? receipts.map((item) => `- [${item.kind}] ${item.title}: ${item.pathOrUrl} (${item.confidence}; ${item.freshness})`)
      : ['- No source receipts found; inspect repo and vault context before acting.']),
    '',
    'CONTEXT MAP RULES:',
    '- Quote the receipt you relied on in your final report.',
    '- If a receipt contradicts the task, stop and open/return a human gate.',
    '- Treat sensitive local/vault paths as private evidence; do not paste private content externally.',
  ].join('\n');
}

function safeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mission';
}
