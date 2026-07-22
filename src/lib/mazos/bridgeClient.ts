export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function gitStatus(repoPath: string): Promise<string> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('git_status', { repo_path: repoPath });
  }
  const res = await fetch(`/api/mazos/git-status?repo=${encodeURIComponent(repoPath)}`);
  return res.text();
}

export async function gitLogRecent(repoPath: string, since: string): Promise<string> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('git_log_recent', { repo_path: repoPath, since });
  }
  const res = await fetch(`/api/mazos/git-log?repo=${encodeURIComponent(repoPath)}&since=${encodeURIComponent(since)}`);
  return res.text();
}
