import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { PATHS } from './paths';

const repos = [
  { id: 'mazos_ui', label: 'MazOS UI', path: PATHS.mazos_ui, github: 'https://github.com/manazoid4/mazos-ui' },
  { id: 'recall', label: 'Recall', path: PATHS.recall, github: '' },
  { id: 'jobfilter', label: 'JobFilter', path: fs.existsSync(PATHS.jobfilter) ? PATHS.jobfilter : PATHS.jobfilter_alt, github: '' },
  { id: 'openflowkit', label: 'OpenFlowKit', path: PATHS.openflowkit, github: '' },
  { id: 'obsidian', label: 'Obsidian Vault', path: PATHS.obsidian, github: '' },
];

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
    return {
      ...r, exists, branch: branch || 'n/a', dirty: Boolean(status), status, unpushedCount: unpushed ? unpushed.split('\n').length : 0,
      lastModified: exists ? fs.statSync(r.path).mtime.toISOString() : null,
      packageManager: exists ? (fs.existsSync(path.join(r.path, 'pnpm-lock.yaml')) ? 'pnpm' : fs.existsSync(path.join(r.path, 'yarn.lock')) ? 'yarn' : fs.existsSync(path.join(r.path, 'package-lock.json')) ? 'npm' : pkg ? 'npm' : 'none') : 'missing',
      scripts, buildScript: Boolean(scripts.build), lintScript: Boolean(scripts.lint), typecheckScript: Boolean(scripts.typecheck),
    };
  });
}
