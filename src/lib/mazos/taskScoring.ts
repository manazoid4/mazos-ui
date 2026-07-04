import fs from 'fs';
import path from 'path';
import { scanRepos } from './repoScanner';
import { PATHS } from './paths';

export type AgentMode = 'prompt-only' | 'safe shell' | 'build/lint' | 'research-first';
export type TaskRiskLevel = 'safe' | 'caution' | 'danger';

export type TaskGateInput = {
  repoPath?: string;
  repoLabel?: string;
  task?: string;
  successCriteria?: string;
  forbiddenActions?: string;
  agent?: string;
  mode?: AgentMode;
  urgency?: string;
  expectedFiles?: string;
  runBuild?: boolean;
  runLint?: boolean;
  allowShell?: boolean;
  researchFirst?: boolean;
};

export type TaskGateOutput = {
  approved: boolean;
  score: number;
  riskLevel: TaskRiskLevel;
  blockers: string[];
  warnings: string[];
  missingInfo: string[];
  recommendedAgentMode: AgentMode;
  suggestedPrompt: string;
  successChecklist: string[];
  validationCommands: string[];
  forbiddenActions: string[];
  nextBestAction: string;
  smallerSessions: string[];
  repo?: {
    path: string;
    label: string;
    exists: boolean;
    branch: string;
    dirty: boolean;
    buildScript: boolean;
    lintScript: boolean;
  };
};

export const DEFAULT_FORBIDDEN_ACTIONS = [
  'No destructive commands.',
  'No force push.',
  'No credential changes.',
  'No global installs.',
  'No recurring loops.',
  'No private scraping or authentication bypass.',
  'Do not push to GitHub unless Maz explicitly asks.',
];

const DANGEROUS_PATTERNS = [
  /\brm\s+-rf\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+push\s+--force\b/i,
  /\bforce\s+push\b/i,
  /\bdelete\s+(database|repo|repository|vault|credentials?)\b/i,
  /\b(scrape|crawl)\s+private\b/i,
  /\bbypass\s+(auth|authentication|login)\b/i,
  /\bedit\s+(\.env|credentials?|secrets?)\b/i,
];

const BROAD_PATTERNS = [
  /\beverything\b/i,
  /\bwhole\s+(app|system|repo|thing)\b/i,
  /\bmake\s+it\s+(perfect|amazing|market[- ]?leading)\b/i,
  /\bfix\s+all\b/i,
  /\bcomplete\s+rewrite\b/i,
  /\bfrom\s+scratch\b/i,
];

const RESEARCH_PATTERNS = [
  /\bcompetitor/i,
  /\bresearch\b/i,
  /\bmarket\b/i,
  /\bbenchmark\b/i,
  /\bpricing\b/i,
  /\bpositioning\b/i,
];

export function knownRepoOptions() {
  return [
    { label: 'MAZos', path: PATHS.mazos_ui },
    { label: 'Recall', path: PATHS.recall },
    { label: 'JobFilter', path: fs.existsSync(PATHS.jobfilter) ? PATHS.jobfilter : PATHS.jobfilter_alt },
    { label: 'OpenFlowKit', path: fs.existsSync(PATHS.openflowkit) ? PATHS.openflowkit : PATHS.openflowkit_alt },
  ];
}

export function scoreTask(input: TaskGateInput): TaskGateOutput {
  const task = clean(input.task);
  const successCriteria = clean(input.successCriteria);
  const expectedFiles = clean(input.expectedFiles);
  const repoPath = clean(input.repoPath) || PATHS.mazos_ui;
  const repoLabel = clean(input.repoLabel) || inferRepoLabel(repoPath);
  const forbiddenActions = mergeForbidden(input.forbiddenActions);
  const repos = scanRepos();
  const scanned = repos.find((repo) => samePath(repo.path, repoPath));
  const exists = fs.existsSync(repoPath);
  const scripts = readScripts(repoPath);
  const repo = {
    path: repoPath,
    label: repoLabel,
    exists,
    branch: scanned?.branch || gitBranch(repoPath),
    dirty: Boolean(scanned?.dirty || gitStatus(repoPath)),
    buildScript: Boolean(scanned?.buildScript || scripts.build),
    lintScript: Boolean(scanned?.lintScript || scripts.lint),
  };

  const blockers: string[] = [];
  const warnings: string[] = [];
  const missingInfo: string[] = [];
  let score = 100;

  if (!repo.exists) {
    blockers.push(`Repo path does not exist: ${repoPath}`);
    score -= 45;
  }

  if (!task) {
    missingInfo.push('Task is missing.');
    score -= 25;
  } else if (task.split(/\s+/).length < 6) {
    missingInfo.push('Task is too short to launch a high-quality agent session.');
    score -= 15;
  }

  const tooBroad = BROAD_PATTERNS.some((pattern) => pattern.test(task));
  if (tooBroad || task.split(/\s+/).length > 90) {
    warnings.push('Task is broad. Split it into inspect, implement, and verify sessions.');
    score -= 18;
  }

  const dangerous = DANGEROUS_PATTERNS.filter((pattern) => pattern.test(`${task} ${successCriteria} ${expectedFiles}`));
  if (dangerous.length > 0) {
    blockers.push('Task appears dangerous or permission-sensitive.');
    score -= 50;
  }

  if (!successCriteria) {
    missingInfo.push('Success criteria are missing; generated criteria are included below.');
    score -= 16;
  } else if (successCriteria.split(/\n|;/).filter(Boolean).length < 2 && successCriteria.split(/\s+/).length < 12) {
    warnings.push('Success criteria are thin. Add observable proof and validation output.');
    score -= 8;
  }

  if (!input.forbiddenActions?.trim()) {
    warnings.push('Forbidden actions were missing; safe defaults were added.');
    score -= 6;
  }

  if (!expectedFiles && task) {
    warnings.push('Expected files are not listed; agent may touch too much.');
    score -= 6;
  }

  if (repo.dirty) {
    warnings.push('Repo is dirty. Ask the agent to inspect existing changes and avoid reverting unrelated work.');
    score -= 10;
  }

  if (input.runBuild && !repo.buildScript) {
    warnings.push('Build requested, but no build script was detected.');
    score -= 5;
  }

  if (input.runLint && !repo.lintScript) {
    warnings.push('Lint requested, but no lint script was detected.');
    score -= 5;
  }

  if (input.allowShell) {
    warnings.push('Shell access requested. MAZos safety config may downgrade this to prompt-only.');
    score -= 4;
  }

  const needsResearch = Boolean(input.researchFirst || input.mode === 'research-first' || RESEARCH_PATTERNS.some((pattern) => pattern.test(task)));
  const matchesPriority = priorityScore(repoLabel, task);
  score += matchesPriority;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const riskLevel: TaskRiskLevel = blockers.length > 0 || dangerous.length > 0 ? 'danger' : score < 70 || warnings.length > 2 ? 'caution' : 'safe';
  const recommendedAgentMode: AgentMode = riskLevel === 'danger' ? 'prompt-only' : needsResearch ? 'research-first' : input.runBuild || input.runLint ? 'build/lint' : 'prompt-only';
  const successChecklist = buildSuccessChecklist(input, repo);
  const validationCommands = buildValidationCommands(repo, input);
  const smallerSessions = buildSmallerSessions(input, repo);
  const approved = blockers.length === 0 && score >= 55;
  const suggestedPrompt = buildSuggestedPrompt({
    ...input,
    repoPath,
    repoLabel,
    task: task || `Improve ${repoLabel} with one scoped useful change.`,
    successCriteria: successCriteria || successChecklist.join('\n'),
    forbiddenActions: forbiddenActions.join('\n'),
    mode: recommendedAgentMode,
    researchFirst: needsResearch,
  }, validationCommands, smallerSessions, riskLevel);

  return {
    approved,
    score,
    riskLevel,
    blockers,
    warnings,
    missingInfo,
    recommendedAgentMode,
    suggestedPrompt,
    successChecklist,
    validationCommands,
    forbiddenActions,
    nextBestAction: blockers.length ? 'Fix blockers before launching an agent.' : approved ? 'Copy the suggested prompt into Hermes or generate a mission plan.' : 'Use Improve Prompt or Make Smaller before starting.',
    smallerSessions,
    repo,
  };
}

function clean(value?: string) {
  return (value || '').trim();
}

function mergeForbidden(raw?: string) {
  const custom = (raw || '').split(/\n|;/).map((item) => item.trim()).filter(Boolean);
  const merged = [...custom];
  for (const item of DEFAULT_FORBIDDEN_ACTIONS) {
    if (!merged.some((existing) => normalizeRule(existing) === normalizeRule(item))) merged.push(item);
  }
  return merged;
}

function normalizeRule(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function inferRepoLabel(repoPath: string) {
  const known = knownRepoOptions().find((repo) => samePath(repo.path, repoPath));
  return known?.label || path.basename(repoPath) || 'Selected repo';
}

function samePath(a: string, b: string) {
  return path.normalize(a).toLowerCase() === path.normalize(b).toLowerCase();
}

function readScripts(repoPath: string): Record<string, string> {
  try {
    const pkg = path.join(repoPath, 'package.json');
    if (!fs.existsSync(pkg)) return {};
    return JSON.parse(fs.readFileSync(pkg, 'utf8')).scripts || {};
  } catch {
    return {};
  }
}

function gitBranch(repoPath: string) {
  return safeGit(repoPath, ['branch', '--show-current']) || 'n/a';
}

function gitStatus(repoPath: string) {
  return safeGit(repoPath, ['status', '--short']);
}

function safeGit(repoPath: string, args: string[]) {
  if (!fs.existsSync(path.join(repoPath, '.git'))) return '';
  const { spawnSync } = require('child_process') as typeof import('child_process');
  const result = spawnSync('git', args, { cwd: repoPath, encoding: 'utf8', shell: false });
  return result.status === 0 ? result.stdout.trim() : '';
}

function priorityScore(repoLabel: string, task: string) {
  const lower = `${repoLabel} ${task}`.toLowerCase();
  if (lower.includes('jobfilter') && /(money|conversion|lead|trust|outreach|sales)/.test(lower)) return 8;
  if (lower.includes('recall') && /(ingest|capture|memory|personal ai|retrieval)/.test(lower)) return 8;
  if (lower.includes('mazos') && /(agent|gate|shipping|context|evidence|safety|session)/.test(lower)) return 7;
  if (lower.includes('openflowkit') && /(voice|workflow|automation|agent)/.test(lower)) return 5;
  return 0;
}

function buildSuccessChecklist(input: TaskGateInput, repo: TaskGateOutput['repo']) {
  const existing = (input.successCriteria || '').split(/\n|;/).map((item) => item.trim()).filter(Boolean);
  if (existing.length) return existing;
  const checklist = [
    'The requested change is implemented in the selected repo only.',
    'Changed files are listed with a short reason for each.',
    'No unrelated user/background-agent changes are reverted.',
  ];
  if (repo?.lintScript || input.runLint) checklist.push('Lint/typecheck result is reported.');
  if (repo?.buildScript || input.runBuild) checklist.push('Build result is reported.');
  checklist.push('Remaining risks and next actions are summarized.');
  return checklist;
}

function buildValidationCommands(repo: NonNullable<TaskGateOutput['repo']>, input: TaskGateInput) {
  const commands = [`git -C "${repo.path}" status --short --branch`];
  if ((input.runLint || repo.lintScript) && repo.lintScript) commands.push(`cd "${repo.path}" && npm run lint`);
  if ((input.runBuild || repo.buildScript) && repo.buildScript) commands.push(`cd "${repo.path}" && npm run build`);
  return commands;
}

function buildSmallerSessions(input: TaskGateInput, repo: NonNullable<TaskGateOutput['repo']>) {
  const baseTask = clean(input.task) || `Improve ${repo.label}`;
  return [
    `Session 1 - inspect/research: inspect ${repo.label}, read relevant files, confirm constraints, and produce a scoped plan for: ${baseTask}`,
    `Session 2 - implement core: make the smallest useful change for ${repo.label}, touching only expected files and preserving unrelated changes.`,
    `Session 3 - test/docs/report: run validation, update docs/report if needed, summarize changed files, risks, and exact resume prompt.`,
  ];
}

function buildSuggestedPrompt(input: TaskGateInput, validationCommands: string[], smallerSessions: string[], riskLevel: TaskRiskLevel) {
  const researchLine = input.researchFirst || input.mode === 'research-first'
    ? 'Before coding, research competitor/project context and summarize only the patterns that directly affect this task.'
    : 'Do targeted inspection before coding; do not research broadly unless blocked.';
  return [
    `You are ${input.agent || 'Hermes'} working locally on Maz's Windows PC.`,
    '',
    `Repo: ${input.repoPath}`,
    `Mission: ${input.task}`,
    `Mode: ${input.mode || 'prompt-only'} (${riskLevel} risk)`,
    '',
    researchLine,
    '',
    'Success criteria:',
    input.successCriteria || '- Use the generated checklist from MAZos Task Gate.',
    '',
    'Expected files/directories:',
    input.expectedFiles || '- Inspect first and keep edits tightly scoped.',
    '',
    'Forbidden actions:',
    input.forbiddenActions,
    '',
    'Validation commands to run only if relevant and safe:',
    validationCommands.map((command) => `- ${command}`).join('\n') || '- Report why validation is not available.',
    '',
    'If this is too broad, split it this way:',
    smallerSessions.map((session) => `- ${session}`).join('\n'),
    '',
    'Final response must include: what changed, changed files, validation results, risks, and next 3 actions. Do not push unless Maz explicitly asks.',
  ].join('\n');
}
