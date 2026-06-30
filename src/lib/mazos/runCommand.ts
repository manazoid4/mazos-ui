import { spawn } from 'child_process';
import { appendRun } from './logStore';

export type RunResult = {
  success: boolean; actionId: string; label: string; cwd: string; commandPreview: string;
  stdout: string; stderr: string; exitCode: number | null; startedAt: string; finishedAt: string;
  durationMs: number; nextSuggestedAction: string;
};

export function runCommand(input: { actionId: string; label: string; cwd: string; command: string; args: string[]; nextSuggestedAction?: string; timeoutMs?: number; }) {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const commandPreview = [input.command, ...input.args].join(' ');
  return new Promise<RunResult>((resolve) => {
    const child = spawn(input.command, input.args, { cwd: input.cwd, shell: false, windowsHide: true });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => child.kill(), input.timeoutMs ?? 120000);
    child.stdout.on('data', d => stdout += String(d));
    child.stderr.on('data', d => stderr += String(d));
    child.on('error', e => { stderr += e.message; });
    child.on('close', code => {
      clearTimeout(timer);
      const finishedAt = new Date().toISOString();
      const run: RunResult = {
        success: code === 0, actionId: input.actionId, label: input.label, cwd: input.cwd, commandPreview,
        stdout, stderr, exitCode: code, startedAt, finishedAt, durationMs: Date.now() - started,
        nextSuggestedAction: input.nextSuggestedAction || (code === 0 ? 'Review output; run next safe step.' : 'Copy output into Hermes and ask for fix.')
      };
      appendRun(run); resolve(run);
    });
  });
}

export function promptResult(actionId: string, label: string, prompt: string): RunResult {
  const now = new Date().toISOString();
  const run = { success: true, actionId, label, cwd: process.cwd(), commandPreview: 'manual prompt', stdout: prompt, stderr: '', exitCode: 0, startedAt: now, finishedAt: now, durationMs: 0, nextSuggestedAction: 'Copy prompt into Hermes.' };
  appendRun(run); return run;
}
