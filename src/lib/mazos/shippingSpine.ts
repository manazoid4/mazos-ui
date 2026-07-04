// Shipping Spine: the operating table MAZos opens on. One row per product —
// objective, next shippable action, evidence, blocker, safety, owner, done criteria,
// commercial reason — combined from project status, repo scan, ship log, stale radar,
// decisions, and product playbooks. Server-side only (fs + git).

import fs from 'fs';
import path from 'path';
import { DATA_DIR, DECISIONS_LOG, today } from './paths';
import { PLAYBOOKS, type Playbook } from './playbooks';
import { latestProjectStatus } from './projectStatus';
import { scanRepos } from './repoScanner';
import { computeStaleFindings, type StaleFinding } from './staleRadar';
import { buildShipLog } from './shipLog';
import { foldDecisions, type DecisionEvent, type DecisionItem } from './decisions';
import { rankItem } from './commandCentre';
import { buildHandoff } from './handoff';
import type { SafetyLevel } from './safety';

export type SpineRow = {
  product: string;
  productId: string;
  objective: string;          // playbook currentWedge — what we are trying to win right now
  nextAction: string;         // one concrete next shippable action
  actionSource: 'repo-evidence' | 'playbook-bet';
  commercialReason: string;   // playbook paidOutcome — the money sentence
  evidence: string[];         // compact human-readable facts
  evidencePaths: string[];    // files an agent should read first
  blocker: string;
  blocked: boolean;
  safety: SafetyLevel;
  owner: 'Maz' | 'Hermes' | 'Codex';
  doneCriteria: string[];
  moneyLabel: 'high' | 'medium' | 'low';
  score: number;
  repoPath: string | null;
  branch: string | null;
  github: string | null;
  dirty: number;
  commits7d: number;
  staleFindings: { severity: string; title: string }[];
  openDecisions: { id: string; question: string }[];
  handoffPrompt: string;      // ready-to-paste scoped brief for the owner agent
};

export type ShippingSpine = {
  generatedAt: string;
  verdict: { product: string; action: string; why: string; owner: string; safety: SafetyLevel };
  rows: SpineRow[];
  savedTo: string;
  markdown: string;
};

const SNAPSHOT = path.join(DATA_DIR, 'shipping-spine.md');

// projectStatus falls back to generic advice when git + vault are silent; the
// playbook's current bet is a better next action than "create a CURRENT.md".
const GENERIC_NEXT = /^(no recent work found|use the latest commit as the handoff point|add or correct the missing project path)/i;
const NO_BLOCKER = /^no blocker found/i;
// Actions only a human should take: judgement calls on history, merges, money.
const HUMAN_ACTION = /\b(review|decide|choose|approve|merge|discard|resolve the ralph)\b/i;
const GIT_ACTION = /\b(commit|push|pr\b|pull request|branch)\b/i;
const INSPECT_ACTION = /^(review|check|inspect|verify|read)\b/i;

function readDecisions(): DecisionItem[] {
  if (!fs.existsSync(DECISIONS_LOG)) return [];
  const events = fs.readFileSync(DECISIONS_LOG, 'utf8').trim().split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l) as DecisionEvent; } catch { return null; } })
    .filter(Boolean) as DecisionEvent[];
  return foldDecisions(events);
}

function buildRow(p: Playbook, ctx: {
  repoFacts: ReturnType<typeof scanRepos>;
  findings: StaleFinding[];
  commitsByRepo: Map<string, number>;
  decisions: DecisionItem[];
}): SpineRow {
  const status = latestProjectStatus(p.statusQuery);
  const facts = ctx.repoFacts.find(r => r.label === p.shipLogLabel);
  const findings = ctx.findings.filter(f => f.repoLabel === p.shipLogLabel);
  const commits7d = ctx.commitsByRepo.get(p.shipLogLabel) || 0;
  const needle = p.name.toLowerCase();
  const openDecisions = ctx.decisions
    .filter(d => d.status === 'open' && `${d.question} ${d.context}`.toLowerCase().includes(needle))
    .map(d => ({ id: d.id, question: d.question }));

  const generic = GENERIC_NEXT.test(status.nextBestAction);
  const nextAction = generic ? p.currentBet : status.nextBestAction;
  const actionSource: SpineRow['actionSource'] = generic ? 'playbook-bet' : 'repo-evidence';

  const blockedByDecision = openDecisions.length > 0;
  const realBlocker = !NO_BLOCKER.test(status.blocker);
  const blocker = blockedByDecision
    ? `Waiting on human decision: ${openDecisions[0].question}`
    : status.blocker;
  const blocked = blockedByDecision || (realBlocker && status.warnings.length > 0);

  const owner: SpineRow['owner'] = blockedByDecision || HUMAN_ACTION.test(nextAction) ? 'Maz' : p.defaultOwner;
  const safety: SafetyLevel = GIT_ACTION.test(nextAction) ? 'L3' : INSPECT_ACTION.test(nextAction) ? 'L1' : 'L2';

  const evidence = [
    status.latestCommit ? `last commit (24h): ${status.latestCommit}` : `no commits in 24h · ${commits7d} in 7d`,
    facts ? `${facts.exists ? `branch ${facts.branch} · ${facts.dirty ? 'dirty' : 'clean'} · ${facts.unpushedCount} unpushed` : `repo missing at ${facts.path}`}` : 'repo not scanned',
    ...findings.slice(0, 2).map(f => `stale: ${f.title} (${f.severity})`),
    ...status.warnings.slice(0, 2).map(w => `warning: ${w}`),
  ].filter(Boolean);

  const ranked = rankItem(status);

  const handoffPrompt = buildHandoff({
    agent: owner === 'Maz' ? 'Hermes' : owner,
    repoPath: status.resolvedRepoPath || facts?.path || '(no repo path)',
    branch: status.currentBranch || facts?.branch || '(unknown)',
    task: [
      `OBJECTIVE: ${p.currentWedge}`,
      `ACTION: ${nextAction}`,
      `WHY IT PAYS: ${p.paidOutcome}`,
      `DONE WHEN: ${p.doneCriteria.join('; ')}`,
      `FORBIDDEN BLOAT: ${p.forbiddenBloat.join('; ')}`,
    ].join('\n'),
    safety,
    verifyCommands: status.verifyCommands,
    evidencePaths: status.evidencePathsRead.slice(0, 5),
  });

  return {
    product: p.name,
    productId: p.id,
    objective: p.currentWedge,
    nextAction,
    actionSource,
    commercialReason: p.paidOutcome,
    evidence,
    evidencePaths: status.evidencePathsRead.slice(0, 6),
    blocker,
    blocked,
    safety,
    owner,
    doneCriteria: p.doneCriteria,
    moneyLabel: ranked.moneyLabel,
    score: ranked.score,
    repoPath: status.resolvedRepoPath || (facts?.exists ? facts.path : null),
    branch: status.currentBranch || (facts?.exists ? facts.branch : null),
    github: status.githubRemote || facts?.github || null,
    dirty: status.gitStatus.length,
    commits7d,
    staleFindings: findings.map(f => ({ severity: f.severity, title: f.title })),
    openDecisions,
    handoffPrompt,
  };
}

function spineMarkdown(rows: SpineRow[], verdict: ShippingSpine['verdict']): string {
  return [
    `# Shipping Spine — ${today()}`,
    `Generated: ${new Date().toISOString()} · agents: read this before asking what to work on.`,
    ``,
    `## Ship next`,
    `**${verdict.product}** — ${verdict.action}`,
    `Why: ${verdict.why}`,
    `Owner: ${verdict.owner} · Safety: ${verdict.safety}`,
    ``,
    ...rows.flatMap(r => [
      `## ${r.product} (score ${r.score} · ${r.moneyLabel} money · ${r.owner} · ${r.safety})`,
      `- objective: ${r.objective}`,
      `- next: ${r.nextAction} _(${r.actionSource})_`,
      `- why it pays: ${r.commercialReason}`,
      `- blocker: ${r.blocker}${r.blocked ? ' **[BLOCKED]**' : ''}`,
      ...r.evidence.map(e => `- evidence: ${e}`),
      `- done when: ${r.doneCriteria.join('; ')}`,
      ``,
    ]),
  ].join('\n');
}

export function buildShippingSpine(): ShippingSpine {
  const repoFacts = scanRepos();
  const findings = computeStaleFindings(repoFacts);
  const ship = buildShipLog();
  const commitsByRepo = new Map<string, number>();
  for (const d of ship.days) for (const c of d.commits) commitsByRepo.set(c.repo, (commitsByRepo.get(c.repo) || 0) + 1);
  const decisions = readDecisions();

  const rows = PLAYBOOKS
    .map(p => buildRow(p, { repoFacts, findings, commitsByRepo, decisions }))
    .sort((a, b) => (Number(a.blocked) - Number(b.blocked)) || (b.score - a.score));

  const top = rows.find(r => !r.blocked) || rows[0];
  const verdict: ShippingSpine['verdict'] = {
    product: top.product,
    action: top.nextAction,
    why: top.commercialReason,
    owner: top.owner,
    safety: top.safety,
  };

  const markdown = spineMarkdown(rows, verdict);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SNAPSHOT, markdown);

  return { generatedAt: new Date().toISOString(), verdict, rows, savedTo: SNAPSHOT, markdown };
}
