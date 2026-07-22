export type RuntimeStatus = {
  mode: 'desktop' | 'web';
  standaloneReady: boolean;
  backend: string;
  capabilities: string[];
  limitations: string[];
};

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function getRuntimeStatus(): Promise<RuntimeStatus> {
  if (isTauriRuntime()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<RuntimeStatus>('runtime_status');
  }

  return {
    mode: 'web',
    standaloneReady: true,
    backend: 'next-server',
    capabilities: ['next-route-handlers'],
    limitations: [],
  };
}
