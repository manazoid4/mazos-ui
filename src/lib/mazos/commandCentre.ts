// Command centre ranking: turn raw project statuses into a "What Now" ranking by
// urgency, blocker state, money impact, and freshness. Pure module — client-safe.

import type { ProjectStatus } from './projectStatus';

export type RankFactors = { urgency: number; blocker: number; money: number; freshness: number };

export type RankedItem = {
  project: string;
  status: ProjectStatus;
  score: number;
  factors: RankFactors;
  reason: string;      // why it matters, one line
  moneyLabel: 'high' | 'medium' | 'low';
};

// Money impact: revenue-facing projects rank above internal tooling.
const MONEY: Record<string, number> = { jobfilter: 30, recall: 18, openflowkit: 18, mazos: 8, 'mazos ui': 8, vault: 6, obsidian: 6 };
const MONEY_LABEL = (n: number): RankedItem['moneyLabel'] => (n >= 25 ? 'high' : n >= 12 ? 'medium' : 'low');

function norm(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

function commitAgeHours(status: ProjectStatus): number | null {
  // latestCommits format: "<hash> <iso date> <subject>"
  const first = status.latestCommits[0];
  if (!first) return null;
  const m = first.match(/\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/);
  if (!m) return null;
  const t = Date.parse(m[0].replace(' ', 'T'));
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 3_600_000;
}

export function rankItem(status: ProjectStatus): RankedItem {
  const key = norm(status.matchedProject || status.query);
  const money = MONEY[key] ?? 6;

  const hasRealBlocker = !!status.blocker && !/^no blocker/i.test(status.blocker);
  const dirtyCount = status.gitStatus.length;
  const appDirty = status.dirtyGroups?.app?.length || 0;

  const urgency =
    status.warnings.length * 12 +
    (status.missing.length ? 8 : 0) +
    Math.min(appDirty * 4, 20);
  const blocker = hasRealBlocker ? 18 : 0;

  const age = commitAgeHours(status);
  // Fresh work (touched in last 24h) is worth continuing now; totally stale internal work sinks.
  const freshness = age === null ? 0 : age < 6 ? 16 : age < 24 ? 10 : age < 72 ? 4 : 0;

  const factors: RankFactors = { urgency, blocker, money, freshness };
  const score = urgency + blocker + money + freshness;

  const reason = status.warnings[0]
    || (hasRealBlocker ? status.blocker : '')
    || (dirtyCount ? `${dirtyCount} uncommitted change(s) to resolve.` : '')
    || status.nextBestAction;

  return { project: status.matchedProject || status.query, status, score, factors, reason, moneyLabel: MONEY_LABEL(money) };
}

export function rankWhatNow(statuses: ProjectStatus[]): RankedItem[] {
  return statuses.map(rankItem).sort((a, b) => b.score - a.score);
}
