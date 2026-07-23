export type RuntimeStatus = {
  mode: 'desktop' | 'web';
  standaloneReady: boolean;
  backend: string;
  registryPath: string;
  capabilities: string[];
  limitations: string[];
};

export type BackendConnection = {
  baseUrl: string;
  token: string;
};

export type DesktopWorkspace = {
  id: string;
  label: string;
  path: string;
};

let backendConnectionPromise: Promise<BackendConnection> | null = null;
let desktopFetchInstalled = false;

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
}

export async function getBackendConnection(): Promise<BackendConnection> {
  if (!isTauriRuntime()) throw new Error('Packaged backend connection is available only in Tauri.');
  backendConnectionPromise ??= tauriInvoke<BackendConnection>('backend_connection');
  return backendConnectionPromise;
}

export async function installDesktopFetchAdapter(): Promise<void> {
  if (!isTauriRuntime() || desktopFetchInstalled) return;

  const connection = await getBackendConnection();
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const backendBaseUrl = connection.token ? connection.baseUrl : globalThis.location.origin;

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const value = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (!value.startsWith('/api/mazos')) return nativeFetch(input, init);

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    if (init?.headers) {
      new Headers(init.headers).forEach((headerValue, name) => headers.set(name, headerValue));
    }
    if (connection.token) headers.set('x-mazos-token', connection.token);

    return nativeFetch(`${backendBaseUrl}${value}`, {
      ...init,
      headers,
    });
  };

  desktopFetchInstalled = true;
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
