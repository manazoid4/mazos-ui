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

type AgentRuntimeConfig = {
  id: string; name: string; kind: AgentRuntime['kind']; pathHint: string;
  status?: AgentRuntime['status']; safetyCeiling?: SafetyLevel; allowedModes?: string[];
  preferredTasks: string[]; forbiddenExtra?: string[]; validationCommands: string[];
  bridgeAware: boolean; lastTraceHint: string;
};

function loadRuntimeConfigs(): AgentRuntimeConfig[] {
  const raw = fs.readFileSync(path.join(ROOT, 'config', 'agent-runtimes.json'), 'utf8');
  return JSON.parse(raw);
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
  const runtimes: AgentRuntime[] = loadRuntimeConfigs().map(c => c.id === 'hermes' ? {
    id: c.id, name: c.name, kind: c.kind,
    status: runtimeStatus(path.join(USER_HOME, 'AppData', 'Local', 'hermes', 'hermes-agent')),
    pathHint: c.pathHint,
    safetyCeiling: safety.allowShell ? 'L3' : 'L1',
    allowedModes: shellModes,
    preferredTasks: c.preferredTasks,
    forbidden: commonForbidden,
    validationCommands: c.validationCommands,
    bridgeAware: c.bridgeAware,
    lastTraceHint: c.lastTraceHint,
  } : {
    id: c.id, name: c.name, kind: c.kind,
    status: c.status ?? 'unknown',
    pathHint: c.pathHint,
    safetyCeiling: c.safetyCeiling ?? 'L1',
    allowedModes: c.allowedModes ?? [],
    preferredTasks: c.preferredTasks,
    forbidden: c.forbiddenExtra ? [...commonForbidden, ...c.forbiddenExtra] : commonForbidden,
    validationCommands: c.validationCommands,
    bridgeAware: c.bridgeAware,
    lastTraceHint: c.lastTraceHint,
  });

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
