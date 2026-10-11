import { spawnSync } from 'node:child_process';

export type GatewayObservation = {
  state: 'scheduled-running' | 'scheduled-ready' | 'unknown';
  evidence: string;
  observedAt: string | null;
};

// Only inspect a known, locally installed Hermes profile, not an arbitrary
// command or task name passed in from the network.
export function inspectHermesScheduledGateway(profile: string): GatewayObservation {
  if (process.platform !== 'win32' || !/^[a-z0-9_-]{1,40}$/.test(profile)) {
    return { state: 'unknown', evidence: 'Windows scheduled-task inspection unavailable', observedAt: null };
  }
  const task = 'Hermes_Gateway_' + profile;
  try {
    const result = spawnSync('schtasks.exe', ['/Query', '/TN', task, '/FO', 'LIST'], {
      encoding: 'utf8', timeout: 1700, windowsHide: true, shell: false, maxBuffer: 100 * 1024,
    });
    if (result.error || result.status !== 0) {
      return { state: 'unknown', evidence: 'Windows gateway task absent or unreadable', observedAt: null };
    }
    const output = result.stdout || '';
    // English-language status only. On non-English Windows, stay honest.
    const match = output.match(/^Status:\s*(Running|Ready)\s*$/im);
    if (!match) {
      return { state: 'unknown', evidence: 'Windows task state could not be interpreted', observedAt: null };
    }
    return match[1].toLowerCase() === 'running'
      ? { state: 'scheduled-running', evidence: 'Windows Task Scheduler reports the Hermes gateway task running; current LLM activity unverified', observedAt: new Date().toISOString() }
      : { state: 'scheduled-ready', evidence: 'Windows Task Scheduler reports the Hermes gateway task ready, not running', observedAt: new Date().toISOString() };
  } catch {
    return { state: 'unknown', evidence: 'Scheduled-task query failed', observedAt: null };
  }
}

export function gatewayLabel(state: GatewayObservation['state']): string {
  if (state === 'scheduled-running') return 'Gateway task running';
  if (state === 'scheduled-ready') return 'Gateway task not running';
  return 'Session unverified';
}
