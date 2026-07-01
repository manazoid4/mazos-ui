// Ship Log (Ghost/Plausible-inspired): what shipped in the last 7 days across the
// priority repos, grouped per day, plus simple local counters. Read-only git log,
// no tracking, no network. Server-side only.

import fs from 'fs';
import { spawnSync } from 'child_process';
import { PATHS } from './paths';
import { readRuns } from './logStore';

const REPOS = [
  { label: 'MAZos UI', path: PATHS.mazos_ui },
  { label: 'Recall', path: PATHS.recall },
  { label: 'JobFilter', path: fs.existsSync(PATHS.jobfilter) ? PATHS.jobfilter : PATHS.jobfilter_alt },
  { label: 'OpenFlowKit', path: PATHS.openflowkit },
];

type Commit = { repo: string; day: string; hash: string; subject: string };

export type ShipLog = {
  generatedAt: string;
  days: { day: string; commits: Commit[] }[];
  counters: { commitsToday: number; commits7d: number; reposActive: number; runsOk: number; runsFail: number };
  markdown: string;
};

function gitLog(cwd: string): string {
  const r = spawnSync('git', ['log', '--since=7.days', '--date=short', '--pretty=%h|%ad|%s'], { cwd, encoding: 'utf8', shell: false });
  return r.status === 0 ? r.stdout.trim() : '';
}

export function buildShipLog(): ShipLog {
  const commits: Commit[] = [];
  for (const r of REPOS) {
    if (!fs.existsSync(r.path)) continue;
    for (const line of gitLog(r.path).split('\n').filter(Boolean)) {
      const [hash, day, ...rest] = line.split('|');
      commits.push({ repo: r.label, day, hash, subject: rest.join('|') });
    }
  }
  const byDay = new Map<string, Commit[]>();
  for (const c of commits) { if (!byDay.has(c.day)) byDay.set(c.day, []); byDay.get(c.day)!.push(c); }
  const days = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([day, cs]) => ({ day, commits: cs }));

  const todayStr = new Date().toISOString().slice(0, 10);
  const runs = readRuns(50);
  const counters = {
    commitsToday: commits.filter(c => c.day === todayStr).length,
    commits7d: commits.length,
    reposActive: new Set(commits.map(c => c.repo)).size,
    runsOk: runs.filter((r: { success: boolean }) => r.success).length,
    runsFail: runs.filter((r: { success: boolean }) => !r.success).length,
  };

  const markdown = [
    `# Shipped — week of ${todayStr}`,
    ``,
    `${counters.commits7d} commit(s) across ${counters.reposActive} project(s) in the last 7 days.`,
    ``,
    ...days.flatMap(d => [
      `## ${d.day}`,
      ...d.commits.map(c => `- **${c.repo}** ${c.subject} (\`${c.hash}\`)`),
      ``,
    ]),
    days.length === 0 ? '_Nothing shipped in the last 7 days._' : '',
  ].filter(l => l !== '').join('\n');

  return { generatedAt: new Date().toISOString(), days, counters, markdown };
}
