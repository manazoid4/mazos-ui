import fs from 'fs';
import path from 'path';
import { PATHS, VAULT_INDEX, VAULT_SCAN_MD } from './paths';
import { runCommand, promptResult } from './runCommand';
import { scanRepos } from './repoScanner';
import { safetyForAction, type SafetyLevel } from './safety';

export type Action = { id: string; label: string; description: string; category: string; enabled: boolean; disabledReason?: string; dangerLevel: 'safe'|'caution'|'danger'; safetyLevel: SafetyLevel; handler: 'command'|'prompt'|'repo'|'vault'; expectedOutput: string; fallbackPrompt: string; command?: string; args?: string[]; cwd?: string; timeoutMs?: number; };
export function actions(): Action[] { return rawActions().map(a => ({ ...a, safetyLevel: safetyForAction(a.dangerLevel, a.handler) })); }

// Per-repo verify actions: the mechanical gate every loop iteration must pass.
// Single command each — runCommand spawns without a shell, so no `&&` chains.
const verifyRepo = (id: string, label: string, repoPath: string): Omit<Action,'safetyLevel'> => ({
  id, label, description: `npm run build in ${repoPath}`, category: 'Verify',
  enabled: fs.existsSync(path.join(repoPath, 'package.json')),
  disabledReason: fs.existsSync(path.join(repoPath, 'package.json')) ? undefined : `${repoPath} missing or has no package.json`,
  dangerLevel: 'safe', handler: 'command', cwd: repoPath, command: 'npm', args: ['run', 'build'],
  expectedOutput: 'Build output with exit code', fallbackPrompt: `Run npm run build in ${repoPath} and report exact failures.`,
  timeoutMs: 300000,
});

function rawActions(): Omit<Action,'safetyLevel'>[] { return [
  verifyRepo('verify_mazos', 'Verify MAZos', PATHS.mazos_ui),
  verifyRepo('verify_jobfilter', 'Verify JobFilter', fs.existsSync(PATHS.jobfilter) ? PATHS.jobfilter : PATHS.jobfilter_alt),
  verifyRepo('verify_flowlens', 'Verify FlowLens', PATHS.flowlens),
  verifyRepo('verify_recall', 'Verify Recall', PATHS.recall),
  verifyRepo('verify_openflowkit', 'Verify OpenFlow', fs.existsSync(PATHS.openflowkit) ? PATHS.openflowkit : PATHS.openflowkit_alt),
  { id:'run_triage', label:'Run Triage Now', description:'Headless Claude triage: findings + proposed loops (bounded 20min).', category:'Ops', enabled:true, dangerLevel:'safe', handler:'command', cwd:PATHS.mazos_ui, command:'powershell', args:['-NoProfile','-ExecutionPolicy','Bypass','-File','scripts/run-morning-triage.ps1'], expectedOutput:'triage.md + proposed-loops.json + receipt', fallbackPrompt:'Run the mazos-triage skill manually in Claude Code and obey its STOP section.', timeoutMs: 1500000 },
  { id:'daily_triage_l1', label:'Daily Triage L1', description:'Manual report-only triage; max 3 priorities.', category:'Ops', enabled:true, dangerLevel:'safe', handler:'prompt', expectedOutput:'Report-only triage prompt', fallbackPrompt:'Run MAZos Daily Triage in L1 report-only mode. Read STATE.md, LOOP.md, loop-budget.md, 03-MEMORY/PROJECT_INDEX.md, 03-MEMORY/CURRENT_TASKS.md, and relevant 02-PROJECTS CURRENT notes. Inspect git status only. Return max 3 high-priority items, current blocker, one next action, and evidence paths. Do not edit files, commit, push, deploy, scrape, touch credentials, or run paid/account actions.' },
  { id:'write_session_handoff', label:'Write Session Handoff', description:'Create handoff prompt.', category:'Ops', enabled:true, dangerLevel:'safe', handler:'prompt', expectedOutput:'Handoff prompt', fallbackPrompt:'Write a concise session handoff: mission, completed, changed files, test output, blockers, next 5 actions.' },
  { id:'repo_health_scan', label:'Repo Health Scan', description:'Scan configured repos.', category:'Ops', enabled:true, dangerLevel:'safe', handler:'repo', expectedOutput:'Repo JSON summary', fallbackPrompt:'Run a repo health scan for MazOS, Recall, JobFilter, OpenFlowKit, FlowLens, Obsidian.' },
  { id:'find_dirty_repos', label:'Find Dirty Repos', description:'git status for MazOS.', category:'Ops', enabled:true, dangerLevel:'safe', handler:'command', cwd:PATHS.mazos_ui, command:'git', args:['status','--short'], expectedOutput:'Git status', fallbackPrompt:'Find dirty repos and summarize changed files.' },
  { id:'find_unpushed_work', label:'Find Unpushed Work', description:'git unpushed for MazOS.', category:'Ops', enabled:true, dangerLevel:'safe', handler:'command', cwd:PATHS.mazos_ui, command:'git', args:['log','@{u}..','--oneline'], expectedOutput:'Unpushed commits', fallbackPrompt:'Find unpushed commits in priority repos.' },
  { id:'vault_index', label:'Vault Index', description:'Lightweight vault scan.', category:'Ops', enabled:fs.existsSync(PATHS.obsidian), disabledReason:fs.existsSync(PATHS.obsidian)?undefined:'Vault missing', dangerLevel:'safe', handler:'vault', expectedOutput:'vault-index.json + latest-vault-scan.md', fallbackPrompt:'Scan vault lightly; do not load entire vault.' },
];}

export async function runAction(id: string) {
  const action = actions().find(a => a.id === id);
  if (!action) return promptResult(id, 'Unknown action', `Unknown action: ${id}`);
  if (!action.enabled) return promptResult(id, action.label, `Disabled: ${action.disabledReason || 'not available'}\n\nFallback:\n${action.fallbackPrompt}`);
  if (action.handler === 'command') return runCommand({ actionId: action.id, label: action.label, cwd: action.cwd!, command: action.command!, args: action.args || [], nextSuggestedAction: action.fallbackPrompt, timeoutMs: action.timeoutMs });
  if (action.handler === 'repo') return promptResult(action.id, action.label, JSON.stringify(scanRepos(), null, 2));
  if (action.handler === 'vault') return scanVault(action);
  return promptResult(action.id, action.label, action.fallbackPrompt);
}

function scanVault(action: Action) {
  const files: any[] = [];
  const walk = (dir: string) => { for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name); if (ent.isDirectory() && files.length < 200) walk(p); else if (ent.isFile() && ent.name.endsWith('.md')) files.push({ path: p, mtime: fs.statSync(p).mtime.toISOString(), size: fs.statSync(p).size });
  }};
  if (fs.existsSync(PATHS.obsidian)) walk(PATHS.obsidian);
  files.sort((a,b)=>b.mtime.localeCompare(a.mtime));
  fs.mkdirSync(path.dirname(VAULT_INDEX), { recursive: true }); fs.mkdirSync(path.dirname(VAULT_SCAN_MD), { recursive: true });
  fs.writeFileSync(VAULT_INDEX, JSON.stringify({ scannedAt: new Date().toISOString(), root: PATHS.obsidian, count: files.length, latest: files.slice(0,25) }, null, 2));
  fs.writeFileSync(VAULT_SCAN_MD, `# Latest Vault Scan\n\nScanned: ${new Date().toISOString()}\n\nFiles indexed: ${files.length}\n\n` + files.slice(0,25).map(f=>`- ${f.mtime} — ${f.path}`).join('\n'));
  return promptResult(action.id, action.label, `Wrote:\n- ${VAULT_INDEX}\n- ${VAULT_SCAN_MD}\n\nLatest files:\n${files.slice(0,10).map(f=>f.path).join('\n') || 'No markdown files found.'}`);
}
