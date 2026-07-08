import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { PATHS, ROOT } from './paths';

type TrackedRepoConfig = { id: string; label: string; pathKey: keyof typeof PATHS; pathKeyAlt?: keyof typeof PATHS; github: string };

function loadTrackedRepos(): TrackedRepoConfig[] {
  const raw = fs.readFileSync(path.join(ROOT, 'config', 'tracked-repos.json'), 'utf8');
  return JSON.parse(raw);
}

const repos = loadTrackedRepos().map(r => ({
  id: r.id,
  label: r.label,
  path: r.pathKeyAlt && !fs.existsSync(PATHS[r.pathKey]) ? PATHS[r.pathKeyAlt] : PATHS[r.pathKey],
  github: r.github,
}));

function git(cwd: string, args: string[]) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', shell: false });
  return r.status === 0 ? r.stdout.trim() : '';
}

export function scanRepos() {
  return repos.map(r => {
    const exists = fs.existsSync(r.path);
    const pkgPath = path.join(r.path, 'package.json');
    const pkg = exists && fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) : null;
    const scripts = pkg?.scripts || {};
    const status = exists ? git(r.path, ['status', '--short']) : '';
    const branch = exists ? git(r.path, ['branch', '--show-current']) : '';
    const unpushed = exists ? git(r.path, ['log', '@{u}..', '--oneline']) : '';
    const lastCommitIso = exists ? git(r.path, ['log', '-1', '--format=%cI']) : '';
    return {
      ...r, exists, branch: branch || 'n/a', dirty: Boolean(status), status, unpushedCount: unpushed ? unpushed.split('\n').length : 0,
      lastModified: exists ? fs.statSync(r.path).mtime.toISOString() : null,
      lastCommitIso: lastCommitIso || null,
      packageManager: exists ? (fs.existsSync(path.join(r.path, 'pnpm-lock.yaml')) ? 'pnpm' : fs.existsSync(path.join(r.path, 'yarn.lock')) ? 'yarn' : fs.existsSync(path.join(r.path, 'package-lock.json')) ? 'npm' : pkg ? 'npm' : 'none') : 'missing',
      scripts, buildScript: Boolean(scripts.build), lintScript: Boolean(scripts.lint), typecheckScript: Boolean(scripts.typecheck),
    };
  });
}
