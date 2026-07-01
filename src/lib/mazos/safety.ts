// Safety levels for every MAZos action. Default posture: safe / report-only (L1).
// The cockpit never silently escalates; higher levels are opt-in and must be shown to the user.

export type SafetyLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

export type SafetySpec = {
  level: SafetyLevel;
  label: string;
  short: string;
  meaning: string;
  requiresConfirm: boolean;
};

export const SAFETY_LEVELS: Record<SafetyLevel, SafetySpec> = {
  L1: { level: 'L1', label: 'Report-only', short: 'read', meaning: 'Read files, git status, summaries. No writes anywhere.', requiresConfirm: false },
  L2: { level: 'L2', label: 'Local edit', short: 'edit', meaning: 'Edit local files or write scan/queue artefacts. No git history change, no network.', requiresConfirm: false },
  L3: { level: 'L3', label: 'Branch / PR', short: 'git', meaning: 'Create branches, commit, push, open PRs. Never pushes to main.', requiresConfirm: true },
  L4: { level: 'L4', label: 'External API', short: 'api', meaning: 'Call external services (web reach, scraping, third-party APIs). ToS + auth boundaries apply.', requiresConfirm: true },
  L5: { level: 'L5', label: 'Deploy / payment / account', short: 'live', meaning: 'Deploys, payments, credential or account changes. Explicit human go every time.', requiresConfirm: true },
};

export const DEFAULT_SAFETY: SafetyLevel = 'L1';

// Map the legacy dangerLevel + handler to a concrete safety level.
export function safetyForAction(dangerLevel: 'safe' | 'caution' | 'danger', handler: 'command' | 'prompt' | 'repo' | 'vault'): SafetyLevel {
  if (handler === 'vault') return 'L2'; // writes scan files
  if (handler === 'prompt' || handler === 'repo') return 'L1'; // report-only
  // command handler: read-only git/build commands stay L1, otherwise caution/danger escalate
  if (dangerLevel === 'danger') return 'L5';
  if (dangerLevel === 'caution') return 'L3';
  return 'L1';
}

export function safetyOf(level: SafetyLevel): SafetySpec {
  return SAFETY_LEVELS[level];
}
