// Handoff prompt generator for Hermes / Codex. Produces a copy-paste operating brief that
// pins repo path, branch, task, safety level, verification commands, and forbidden actions.
// Pure module — safe to import client-side.

import { SAFETY_LEVELS, DEFAULT_SAFETY, type SafetyLevel } from './safety';

export type HandoffInput = {
  agent: 'Hermes' | 'Codex' | string;
  repoPath: string;
  branch: string;
  task: string;
  safety: SafetyLevel;
  verifyCommands: string[];
  evidencePaths?: string[];
  extraForbidden?: string[];
};

// Forbidden actions grow as the safety ceiling drops: an L1 handoff forbids everything above read-only.
export function forbiddenFor(safety: SafetyLevel, extra: string[] = []): string[] {
  const base: string[] = ['Push to main directly.', 'Delete or revert unrelated dirty files.', 'Invent results or claim work you did not verify.'];
  const gated: Record<SafetyLevel, string[]> = {
    L1: ['Edit any file.', 'Commit, push, or open PRs.', 'Call external APIs or scrape.', 'Deploy, pay, or touch credentials/accounts.'],
    L2: ['Commit, push, or open PRs.', 'Call external APIs or scrape.', 'Deploy, pay, or touch credentials/accounts.'],
    L3: ['Call external APIs or scrape without explicit go.', 'Deploy, pay, or touch credentials/accounts.'],
    L4: ['Deploy, pay, or touch credentials/accounts.'],
    L5: [],
  };
  return [...base, ...gated[safety], ...extra];
}

export function buildHandoff(input: HandoffInput): string {
  const safety = input.safety || DEFAULT_SAFETY;
  const spec = SAFETY_LEVELS[safety];
  const verify = input.verifyCommands.filter(Boolean);
  const forbidden = forbiddenFor(safety, input.extraForbidden);
  const evidence = (input.evidencePaths || []).filter(Boolean);

  return [
    `${input.agent}: scoped task handoff. Operate only within the boundaries below.`,
    ``,
    `REPO: ${input.repoPath}`,
    `BRANCH: ${input.branch}`,
    `SAFETY: ${spec.level} ${spec.label} — ${spec.meaning}`,
    input.task ? `\nTASK:\n${input.task}` : `\nTASK:\n(fill in the single next task)`,
    ``,
    `VERIFY (run and paste real output, no summaries of unrun commands):`,
    ...(verify.length ? verify.map(c => `  - ${c}`) : ['  - (add the exact verification commands)']),
    evidence.length ? `\nEVIDENCE TO READ FIRST:\n${evidence.map(p => `  - ${p}`).join('\n')}` : '',
    ``,
    `FORBIDDEN:`,
    ...forbidden.map(f => `  - ${f}`),
    ``,
    `RULES: Inspect before acting. Stay at or below ${spec.level}. If a step needs a higher level, stop and ask. Report exact command output and evidence paths.`,
  ].filter(line => line !== null && line !== undefined).join('\n');
}
