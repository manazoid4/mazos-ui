// Hermes Context Pack (Headroom-inspired): one compact, copyable markdown brief per
// project — repo facts, blocker, next action, verify commands, doctrine. Hard cap ~60
// lines so handoffs stay cheap. Server-side only (fs).

import fs from 'fs';
import path from 'path';
import { DATA_DIR, VAULT_INDEX, today } from './paths';
import { latestProjectStatus } from './projectStatus';

const PACK_DIR = path.join(DATA_DIR, 'context-packs');

export type ContextPack = { project: string; markdown: string; savedTo: string; lines: number };

export function buildContextPack(project: string): ContextPack {
  const s = latestProjectStatus(project);
  // Cached vault scan only — building a pack must never trigger a full vault walk.
  let doctrine: string[] = [];
  try { if (fs.existsSync(VAULT_INDEX)) doctrine = (JSON.parse(fs.readFileSync(VAULT_INDEX, 'utf8')).doctrine || []).slice(0, 3); } catch { /* stale/absent index is fine */ }

  const dirty = s.gitStatus.length;
  const groups = [['app', s.dirtyGroups.app], ['submodule', s.dirtyGroups.submodule], ['generated', s.dirtyGroups.generated], ['docs', s.dirtyGroups.docs]] as const;
  const dirtyLine = dirty ? groups.filter(([, l]) => l.length).map(([k, l]) => `${k} ${l.length}`).join(' · ') : 'clean';

  const lines = [
    `# Context Pack — ${s.matchedProject || project}`,
    `Generated: ${new Date().toISOString()} · read this instead of re-scanning the repo.`,
    ``,
    `## Repo`,
    `- path: ${s.resolvedRepoPath || 'no git repo (Obsidian project)'}`,
    `- branch: ${s.currentBranch || 'n/a'}`,
    `- latest commit: ${s.latestCommit || 'none in 24h'}`,
    `- dirty: ${dirty} file(s) — ${dirtyLine}`,
    s.githubRemote ? `- github: ${s.githubRemote}` : '',
    ``,
    `## State`,
    `- blocker: ${s.blocker}`,
    `- next action: ${s.nextBestAction}`,
    ...s.warnings.slice(0, 3).map(w => `- warning: ${w}`),
    ``,
    `## Verify (run these, paste real output)`,
    ...(s.verifyCommands.length ? s.verifyCommands : ['git status --short']).map(c => `- ${c}`),
    ``,
    `## Recent commits (24h)`,
    ...(s.latestCommits.length ? s.latestCommits.slice(0, 5) : ['none']).map(c => `- ${c}`),
    ``,
    doctrine.length ? `## Doctrine` : '',
    ...doctrine.map(d => `- ${d}`),
    ``,
    `## Evidence read`,
    ...s.evidencePathsRead.slice(0, 6).map(p => `- ${p}`),
  ].filter(l => l !== '');

  const capped = lines.slice(0, 60);
  const markdown = capped.join('\n');
  fs.mkdirSync(PACK_DIR, { recursive: true });
  const savedTo = path.join(PACK_DIR, `${(s.matchedProject || project).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${today()}.md`);
  fs.writeFileSync(savedTo, markdown);
  return { project: s.matchedProject || project, markdown, savedTo, lines: capped.length };
}
