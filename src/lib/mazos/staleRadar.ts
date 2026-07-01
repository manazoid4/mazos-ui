// Stale Work Radar: turn repo scan facts into findings with severity, evidence,
// and the exact next command. Pure module — client-safe.

import { buildLoopPrompt, LOOP_TEMPLATES, type LoopDef } from './loopEngine';

export type RepoFacts = {
  id: string; label: string; path: string; exists: boolean;
  branch: string; dirty: boolean; unpushedCount: number; lastModified: string | null;
  lastCommitIso?: string | null;
};

export type StaleSeverity = 'info' | 'warn' | 'critical';
export type StaleFinding = {
  repoId: string;
  repoLabel: string;
  severity: StaleSeverity;
  title: string;
  evidence: string;
  nextCommand: string;
};

const HOURS = 3_600_000;

export function computeStaleFindings(repos: RepoFacts[]): StaleFinding[] {
  const findings: StaleFinding[] = [];
  for (const r of repos) {
    if (!r.exists) continue;
    // Staleness measured from the last commit — dirty work with no commit landing is the risk.
    const ageH = r.lastCommitIso ? (Date.now() - Date.parse(r.lastCommitIso)) / HOURS : null;
    if (r.unpushedCount > 0) findings.push({
      repoId: r.id, repoLabel: r.label, severity: r.unpushedCount >= 3 ? 'critical' : 'warn',
      title: `${r.unpushedCount} unpushed commit(s)`,
      evidence: `branch ${r.branch} is ahead of upstream by ${r.unpushedCount}`,
      nextCommand: `cd ${r.path} && git log @{u}.. --oneline && git push -u origin ${r.branch}`,
    });
    if (r.dirty && ageH !== null && ageH > 24) findings.push({
      repoId: r.id, repoLabel: r.label, severity: ageH > 72 ? 'critical' : 'warn',
      title: `dirty tree, last commit ${Math.round(ageH)}h ago`,
      evidence: `uncommitted changes on ${r.branch}, last commit ${r.lastCommitIso}`,
      nextCommand: `cd ${r.path} && git status --short && git diff --stat`,
    });
    else if (r.dirty) findings.push({
      repoId: r.id, repoLabel: r.label, severity: 'info',
      title: 'dirty tree (fresh)',
      evidence: `uncommitted changes on ${r.branch}`,
      nextCommand: `cd ${r.path} && git status --short`,
    });
    // Parked branch: clean and nothing ahead of upstream, but no commit landed in 3+ days.
    if (r.branch !== 'main' && r.branch !== 'master' && r.branch !== 'n/a' && r.unpushedCount === 0 && !r.dirty && ageH !== null && ageH > 72) findings.push({
      repoId: r.id, repoLabel: r.label, severity: 'info',
      title: `parked branch ${r.branch}`,
      evidence: `clean, pushed, but idle ${Math.round(ageH / 24)}d — merge or close it`,
      nextCommand: `cd ${r.path} && git log main..${r.branch} --oneline`,
    });
  }
  const order: Record<StaleSeverity, number> = { critical: 0, warn: 1, info: 2 };
  return findings.sort((a, b) => order[a.severity] - order[b.severity]);
}

// Pre-scoped PR babysitter loop prompt for one repo.
export function buildBabysitPrompt(finding: StaleFinding, repoPath: string): string {
  const base = LOOP_TEMPLATES.find(l => l.id === 'pr_babysitter')!;
  const scoped: LoopDef = {
    ...base,
    name: `PR Babysitter — ${finding.repoLabel}`,
    promptTemplate: `Repo: ${repoPath}. Finding: ${finding.title} (${finding.evidence}). Verify with: ${finding.nextCommand}. Then shepherd this branch to a merged PR: push the branch, open a PR if none exists, watch CI, fix small failures on the branch only. Report state, what changed this pass, and what still blocks merge.`,
  };
  return buildLoopPrompt(scoped);
}
