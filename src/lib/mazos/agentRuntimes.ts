import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import { ROOT, USER_HOME } from './paths';
import type { SafetyLevel } from './safety';

export type AgentRuntime = {
  id: string;
  name: string;
  kind: 'local' | 'cloud' | 'cli' | 'browser';
  status: 'ready' | 'configured' | 'unknown' | 'missing';
  pathHint: string;
  safetyCeiling: SafetyLevel;
  allowedModes: string[];
  preferredTasks: string[];
  forbidden: string[];
  validationCommands: string[];
  bridgeAware: boolean;
  lastTraceHint: string;
};

export type AgentRuntimeRegistry = {
  generatedAt: string;
  safety: {
    safeMode: boolean;
    allowShell: boolean;
    allowPush: boolean;
    allowDestructive: boolean;
  };
  recommendedRuntimeId: string;
  recommendationReason: string;
  runtimes: AgentRuntime[];
};

function existsMaybe(pathHint: string) {
  return pathHint.includes('*') ? 'unknown' : fs.existsSync(pathHint) ? 'ready' : 'unknown';
}

function readSafety() {
  try {
    const raw = fs.readFileSync(path.join(ROOT, 'config', 'control-panel.yaml'), 'utf8');
    const parsed = yaml.load(raw) as any;
    return {
      safeMode: parsed?.safety?.safe_mode !== false,
      allowShell: parsed?.safety?.allow_shell === true,
      allowPush: parsed?.safety?.allow_push === true,
      allowDestructive: parsed?.safety?.allow_destructive === true,
    };
  } catch {
    return { safeMode: true, allowShell: false, allowPush: false, allowDestructive: false };
  }
}

function runtimeStatus(pathHint: string): AgentRuntime['status'] {
  const status = existsMaybe(pathHint);
  if (status === 'ready') return 'ready';
  return pathHint ? 'configured' : 'unknown';
}

export function buildAgentRuntimeRegistry(task = ''): AgentRuntimeRegistry {
  const safety = readSafety();
  const shellModes = safety.allowShell ? ['prompt-only', 'safe shell', 'build/lint', 'research-first'] : ['prompt-only', 'research-first'];
  const commonForbidden = [
    'No destructive commands.',
    'No force push.',
    'No credential changes.',
    'No private scraping or authentication bypass.',
    safety.allowPush ? 'Push only through agents/* PR workflow.' : 'No GitHub push from MAZos UI.',
  ];
  const runtimes: AgentRuntime[] = [
    {
      id: 'hermes',
      name: 'Hermes',
      kind: 'local',
      status: runtimeStatus(path.join(USER_HOME, 'AppData', 'Local', 'hermes', 'hermes-agent')),
      pathHint: 'C:/Users/manaz/AppData/Local/hermes/hermes-agent',
      safetyCeiling: safety.allowShell ? 'L3' : 'L1',
      allowedModes: shellModes,
      preferredTasks: ['local memory', 'vault context', 'MAZos operation', 'long handoffs'],
      forbidden: commonForbidden,
      validationCommands: ['Use Task Gate first', 'Quote exact verification output'],
      bridgeAware: true,
      lastTraceHint: 'GET /api/mazos/flight-recorder?product=MAZos',
    },
    {
      id: 'codex',
      name: 'Codex',
      kind: 'cli',
      status: 'configured',
      pathHint: 'Codex desktop / CLI session',
      safetyCeiling: 'L3',
      allowedModes: ['prompt-only', 'build/lint', 'research-first'],
      preferredTasks: ['repo implementation', 'type fixes', 'GitHub PR workflow', 'local verification'],
      forbidden: commonForbidden,
      validationCommands: ['npm run lint', 'npm run build', 'git status --short'],
      bridgeAware: false,
      lastTraceHint: 'Use MAZos Flight Recorder for logged runs and gates.',
    },
    {
      id: 'claude-code',
      name: 'Claude Code',
      kind: 'cli',
      status: 'configured',
      pathHint: 'Claude Code / Hermes-compatible local agent',
      safetyCeiling: 'L3',
      allowedModes: ['prompt-only', 'build/lint', 'research-first'],
      preferredTasks: ['large refactors', 'product design', 'multi-file UI work', 'documentation'],
      forbidden: commonForbidden,
      validationCommands: ['Run repo-specific lint/build', 'Open PR from agents/* branch'],
      bridgeAware: false,
      lastTraceHint: 'Ask agent to paste final handoff into MAZos session note.',
    },
    {
      id: 'opencode',
      name: 'OpenCode',
      kind: 'cli',
      status: 'configured',
      pathHint: 'OpenCode local CLI',
      safetyCeiling: 'L2',
      allowedModes: ['prompt-only', 'research-first'],
      preferredTasks: ['inspection', 'small code edits', 'alternate review'],
      forbidden: commonForbidden,
      validationCommands: ['Prefer read-only inspect first', 'Escalate to Task Gate for writes'],
      bridgeAware: false,
      lastTraceHint: 'No native trace yet; create a mission plan before use.',
    },
    {
      id: 'browser-agent',
      name: 'Browser Agent',
      kind: 'browser',
      status: 'configured',
      pathHint: 'Codex/Vercel browser automation',
      safetyCeiling: 'L4',
      allowedModes: ['prompt-only', 'research-first'],
      preferredTasks: ['UI smoke tests', 'visual verification', 'public web research'],
      forbidden: [...commonForbidden, 'No auth bypass.', 'No private scraping.'],
      validationCommands: ['Capture URL and visible result', 'Do not submit forms without explicit approval'],
      bridgeAware: true,
      lastTraceHint: 'Attach browser smoke result to PR/report.',
    },
  ];

  const lower = task.toLowerCase();
  const recommendedRuntimeId = /ui|visual|browser|screenshot|vercel/.test(lower)
    ? 'browser-agent'
    : /vault|memory|context|openwiki|hermes/.test(lower)
      ? 'hermes'
      : /review|small|inspect/.test(lower)
        ? 'opencode'
        : 'codex';
  const recommendationReason = task
    ? `Selected for task keywords in "${task.slice(0, 120)}".`
    : 'Defaulting to Codex for repo implementation; use Task Gate before launch.';

  return { generatedAt: new Date().toISOString(), safety, recommendedRuntimeId, recommendationReason, runtimes };
}
