import fs from 'fs';
import path from 'path';
import { HERMES_HOME, HERMES_PROFILES_DIR, HERMES_ACTIVE_PROFILE_FILE } from './paths';

const PROFILE_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

// Allowlisted, editable docs only — never exposes .env, auth.json, state.db, etc.
export const EDITABLE_DOCS = [
  'SOUL.md',
  'memories/USER.md',
  'memories/MEMORY.md',
  'memories/USER_PROFILE.md',
  'memories/MEMORY_INDEX.md',
  'memories/HERMES_RULES.md',
  'memories/PROJECTS_INDEX.md',
  'memories/GITHUB_REPOS_INDEX.md',
  'memories/LOOP_LIBRARY.md',
  'memories/PROMPT_INSPIRATION.md',
  'memories/WORKFLOWS.md',
  'memories/DECISIONS.md',
  'memories/EXPORT_POLICY.md',
  'memories/SESSION_CONTROL.md',
] as const;
export type EditableDoc = typeof EDITABLE_DOCS[number];

export type ProfileSummary = {
  name: string;
  path: string;
  isDefault: boolean;
  active: boolean;
  description: string;
  skillCount: number;
};

function normalizeName(name: string): string {
  const trimmed = (name || '').trim().toLowerCase();
  return trimmed === '' ? 'default' : trimmed;
}

function profileDir(name: string): string {
  const canon = normalizeName(name);
  return canon === 'default' ? HERMES_HOME : path.join(HERMES_PROFILES_DIR, canon);
}

export function getActiveProfile(): string {
  try {
    const raw = fs.readFileSync(HERMES_ACTIVE_PROFILE_FILE, 'utf8').trim();
    return raw || 'default';
  } catch {
    return 'default';
  }
}

function readDescription(dir: string): string {
  const p = path.join(dir, 'profile.yaml');
  if (!fs.existsSync(p)) return '';
  const m = fs.readFileSync(p, 'utf8').match(/description:\s*'?([^'\n]*)'?/);
  return m ? m[1].trim() : '';
}

function countSkills(dir: string): number {
  const skillsDir = path.join(dir, 'skills');
  if (!fs.existsSync(skillsDir)) return 0;
  let count = 0;
  const walk = (d: string, depth: number) => {
    if (depth > 3) return;
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (entry.name === 'SKILL.md') count++;
    }
  };
  try { walk(skillsDir, 0); } catch { /* unreadable skills dir — report 0 */ }
  return count;
}

export function listProfiles(): ProfileSummary[] {
  const active = getActiveProfile();
  const out: ProfileSummary[] = [];

  if (fs.existsSync(HERMES_HOME)) {
    out.push({
      name: 'default', path: HERMES_HOME, isDefault: true, active: active === 'default',
      description: readDescription(HERMES_HOME), skillCount: countSkills(HERMES_HOME),
    });
  }

  if (fs.existsSync(HERMES_PROFILES_DIR)) {
    for (const entry of fs.readdirSync(HERMES_PROFILES_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory() || !PROFILE_ID_RE.test(entry.name)) continue;
      const dir = path.join(HERMES_PROFILES_DIR, entry.name);
      out.push({
        name: entry.name, path: dir, isDefault: false, active: active === entry.name,
        description: readDescription(dir), skillCount: countSkills(dir),
      });
    }
  }
  return out;
}

export function readProfileDocs(name: string): Record<string, string> {
  const dir = profileDir(name);
  const docs: Record<string, string> = {};
  for (const doc of EDITABLE_DOCS) {
    const p = path.join(dir, doc);
    docs[doc] = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  }
  return docs;
}

export function writeProfileDoc(name: string, doc: string, content: string): void {
  if (!(EDITABLE_DOCS as readonly string[]).includes(doc)) {
    throw new Error(`doc not editable: ${doc}`);
  }
  const canon = normalizeName(name);
  if (canon !== 'default' && !PROFILE_ID_RE.test(canon)) {
    throw new Error(`invalid profile name: ${name}`);
  }
  const dir = profileDir(canon);
  if (!fs.existsSync(dir)) throw new Error(`profile does not exist: ${canon}`);
  const target = path.join(dir, doc);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

// Mirrors hermes_cli/profiles.py:set_active_profile — atomic write via temp+rename.
export function switchActiveProfile(name: string): void {
  const canon = normalizeName(name);
  if (canon !== 'default' && !fs.existsSync(profileDir(canon))) {
    throw new Error(`profile does not exist: ${canon}`);
  }
  if (canon === 'default') {
    fs.rmSync(HERMES_ACTIVE_PROFILE_FILE, { force: true });
    return;
  }
  const tmp = `${HERMES_ACTIVE_PROFILE_FILE}.tmp`;
  fs.writeFileSync(tmp, `${canon}\n`, 'utf8');
  fs.renameSync(tmp, HERMES_ACTIVE_PROFILE_FILE);
}
