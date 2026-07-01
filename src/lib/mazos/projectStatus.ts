import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { PATHS } from './paths';

type ProjectRef = {
  name: string;
  aliases: string[];
  repoPaths: string[];
  currentPaths: string[];
  evidence: string[];
};

export type ProjectStatus = {
  query: string;
  matchedProject: string | null;
  resolvedRepoPath: string | null;
  missing: string[];
  latestCommits: string[];
  gitStatus: string[];
  currentEntries: string[];
  loopState: string[];
  blocker: string;
  nextBestAction: string;
  evidencePathsRead: string[];
};

const PROJECT_INDEX = path.join(PATHS.obsidian, '03-MEMORY', 'PROJECT_INDEX.md');
const PROJECTS_ROOT = path.join(PATHS.obsidian, '02-PROJECTS');
const KNOWN_REPOS: Record<string, string[]> = {
  mazos: [PATHS.mazos_ui],
  'mazos ui': [PATHS.mazos_ui],
  jobfilter: [PATHS.jobfilter, PATHS.jobfilter_alt, 'C:/Users/manaz/Desktop/JobFilterV1-github'],
  recall: [PATHS.recall],
  openflowkit: [PATHS.openflowkit],
  obsidian: [PATHS.obsidian],
  vault: [PATHS.obsidian],
  hermes: ['C:/Users/manaz/AppData/Local/hermes/hermes-agent'],
};

function readMaybe(filePath: string) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function norm(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function extractPaths(text: string) {
  const matches = text.match(/[A-Z]:[\\/][^`),\]\r\n]+/g) || [];
  return matches.map(x => x.trim().replaceAll('\\', '/').replace(/[.;]+$/, ''));
}

function projectRefsFromVault(): ProjectRef[] {
  const refs: ProjectRef[] = [];
  const index = readMaybe(PROJECT_INDEX);
  if (index) {
    for (const line of index.split(/\r?\n/)) {
      const bullet = line.match(/^-\s+([^—\-]+?)(?:\s*[/,(]|—)/);
      if (!bullet) continue;
      const name = bullet[1].trim();
      const aliases = unique([name, ...name.split('/').map(x => x.trim())]);
      refs.push({
        name,
        aliases,
        repoPaths: extractPaths(line),
        currentPaths: [],
        evidence: [PROJECT_INDEX],
      });
    }
  }

  if (fs.existsSync(PROJECTS_ROOT)) {
    for (const entry of fs.readdirSync(PROJECTS_ROOT, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const current = path.join(PROJECTS_ROOT, entry.name, 'CURRENT.md');
      const text = readMaybe(current);
      refs.push({
        name: entry.name,
        aliases: [entry.name],
        repoPaths: extractPaths(text),
        currentPaths: fs.existsSync(current) ? [current] : [],
        evidence: fs.existsSync(current) ? [current] : [],
      });
    }
  }

  for (const [alias, repoPaths] of Object.entries(KNOWN_REPOS)) {
    refs.push({
      name: alias,
      aliases: [alias],
      repoPaths,
      currentPaths: [],
      evidence: [],
    });
  }

  return refs;
}

function resolveProject(query: string) {
  const q = norm(query);
  const refs = projectRefsFromVault();
  const scored = refs
    .map(ref => {
      const names = ref.aliases.map(norm);
      const exact = names.includes(q) ? 100 : 0;
      const partial = names.some(a => a.includes(q) || q.includes(a)) ? 30 : 0;
      return { ref, score: exact + partial };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = scored[0]?.ref;
  if (!best) return null;

  const related = refs.filter(ref => norm(ref.name) === norm(best.name) || ref.aliases.some(a => best.aliases.map(norm).includes(norm(a))));
  return {
    name: best.name,
    aliases: unique(related.flatMap(x => x.aliases)),
    repoPaths: unique(related.flatMap(x => x.repoPaths)),
    currentPaths: unique(related.flatMap(x => x.currentPaths)),
    evidence: unique(related.flatMap(x => x.evidence)),
  } satisfies ProjectRef;
}

function git(cwd: string, args: string[]) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', shell: false, timeout: 8000 });
  return result.status === 0 ? result.stdout.trim() : '';
}

function summarizeCurrent(text: string, project: string) {
  const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const useful = lines.filter(line => /^[-*]\s+|\[[ x]\]|block|next|todo|current|priority|status|ship|done|fix/i.test(line));
  return (useful.length ? useful : lines)
    .filter(line => !line.startsWith('---'))
    .slice(0, 10)
    .map(line => line.replace(/^#+\s*/, '').slice(0, 240))
    .filter(line => line.toLowerCase() !== project.toLowerCase());
}

function summarizeLoop(repoPath: string | null, evidence: string[]) {
  if (!repoPath) return [];
  const candidates = [
    path.join(/* turbopackIgnore: true */ repoPath, 'STATE.md'),
    path.join(/* turbopackIgnore: true */ repoPath, 'LOOP.md'),
    path.join(/* turbopackIgnore: true */ repoPath, '.ralph', 'STATE.md'),
    path.join(/* turbopackIgnore: true */ repoPath, '.ralph', 'prd.json'),
  ];
  const output: string[] = [];
  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    evidence.push(filePath);
    const text = readMaybe(filePath);
    const lines = filePath.endsWith('.json')
      ? text.split(/\r?\n/).slice(0, 12)
      : summarizeCurrent(text, path.basename(repoPath)).slice(0, 8);
    output.push(`${path.relative(repoPath, filePath).replaceAll('\\', '/')}: ${lines.join(' | ')}`.slice(0, 500));
  }
  return output;
}

function chooseBlocker(status: string[], currentEntries: string[], missing: string[]) {
  const blockerLine = currentEntries.find(x => /block|blocked|missing|dirty|conflict|pending|fail|error/i.test(x));
  if (blockerLine) return blockerLine;
  if (status.length) return `Working tree has ${status.length} changed item(s).`;
  if (missing.length) return missing[0];
  return 'No blocker found in checked git + Obsidian sources.';
}

function chooseNext(commits: string[], status: string[], currentEntries: string[], missing: string[]) {
  const nextLine = currentEntries.find(x => /next|todo|priority|ship|fix|continue/i.test(x));
  if (nextLine) return nextLine;
  if (status.length) return 'Review dirty files, separate generated noise from intentional changes, then commit or discard intentionally.';
  if (missing.length) return 'Add or correct the missing project path in PROJECT_INDEX.md or the project CURRENT.md.';
  if (commits.length) return 'Use the latest commit as the handoff point and pick the next unchecked CURRENT.md task.';
  return 'No recent work found after checking git and Obsidian; create a CURRENT.md next action before starting.';
}

export function latestProjectStatus(query: string): ProjectStatus {
  const evidence: string[] = [];
  const missing: string[] = [];
  if (fs.existsSync(PROJECT_INDEX)) evidence.push(PROJECT_INDEX);
  else missing.push(`Missing project index: ${PROJECT_INDEX}`);

  const project = resolveProject(query);
  if (!project) {
    return {
      query,
      matchedProject: null,
      resolvedRepoPath: null,
      missing: [`No project match for "${query}" in ${PROJECT_INDEX}`],
      latestCommits: [],
      gitStatus: [],
      currentEntries: [],
      loopState: [],
      blocker: 'Project could not be resolved.',
      nextBestAction: 'Add the project to PROJECT_INDEX.md or 02-PROJECTS/<Project>/CURRENT.md, then rerun status.',
      evidencePathsRead: evidence,
    };
  }

  evidence.push(...project.evidence);
  const repoPath = project.repoPaths.find(p => fs.existsSync(p) && fs.existsSync(path.join(p, '.git'))) || null;
  if (!repoPath) missing.push(`No existing git repo path found for ${project.name}. Checked: ${project.repoPaths.join(', ') || 'none'}`);

  const currentPaths = project.currentPaths.length
    ? project.currentPaths
    : [path.join(PROJECTS_ROOT, project.name, 'CURRENT.md')].filter(fs.existsSync);
  const currentEntries = currentPaths.flatMap(filePath => {
    evidence.push(filePath);
    return summarizeCurrent(readMaybe(filePath), project.name);
  });

  const latestCommits = repoPath
    ? git(repoPath, ['log', '--since=24 hours ago', '--pretty=format:%h %ad %s', '--date=iso-local']).split(/\r?\n/).filter(Boolean)
    : [];
  const gitStatus = repoPath ? git(repoPath, ['status', '--short']).split(/\r?\n/).filter(Boolean) : [];
  const loopState = summarizeLoop(repoPath, evidence);

  return {
    query,
    matchedProject: project.name,
    resolvedRepoPath: repoPath,
    missing,
    latestCommits,
    gitStatus,
    currentEntries,
    loopState,
    blocker: chooseBlocker(gitStatus, currentEntries, missing),
    nextBestAction: chooseNext(latestCommits, gitStatus, currentEntries, missing),
    evidencePathsRead: unique(evidence),
  };
}
