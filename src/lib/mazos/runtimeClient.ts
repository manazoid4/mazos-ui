export type RuntimeStatus = {
  mode: 'desktop' | 'web';
  standaloneReady: boolean;
  backend: string;
  registryPath: string;
  capabilities: string[];
  limitations: string[];
};

export type DesktopWorkspace = {
  id: string;
  label: string;
  path: string;
};

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
}

export async function getRuntimeStatus(): Promise<RuntimeStatus> {
  if (isTauriRuntime()) {
    return tauriInvoke<RuntimeStatus>('runtime_status');
  }

  return {
    mode: 'web',
    standaloneReady: true,
    backend: 'next-server',
    registryPath: '',
    capabilities: ['next-route-handlers'],
    limitations: [],
  };
}

export async function listDesktopWorkspaces(): Promise<DesktopWorkspace[]> {
  if (!isTauriRuntime()) return [];
  return tauriInvoke<DesktopWorkspace[]>('list_workspaces');
}

export async function saveDesktopWorkspaces(workspaces: DesktopWorkspace[]): Promise<DesktopWorkspace[]> {
  if (!isTauriRuntime()) throw new Error('Workspace registry is available only in the desktop runtime.');
  return tauriInvoke<DesktopWorkspace[]>('save_workspaces', { workspaces });
}

export async function getDesktopGitStatus(repoId: string): Promise<string> {
  if (!isTauriRuntime()) throw new Error('Desktop Git status is available only in the desktop runtime.');
  return tauriInvoke<string>('git_status', { repoId });
}
