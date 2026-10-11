import { existsSync } from 'node:fs';
export type Service = {
  id: string;
  label: string;
  kind: 'local' | 'cloud' | 'repo' | 'vault' | 'desktop';
  url?: string;
  path?: string;
  expected?: 'online' | 'external' | 'local-optional' | 'missing-ok';
};

export async function serviceHealth() {
  const services: Service[] = [
    { id: 'mazos', label: 'MazOS Cockpit', kind: 'local', url: 'http://localhost:3046', expected: 'online' },
    { id: 'recall_local', label: 'Recall Local API', kind: 'local', url: 'http://localhost:3029', expected: 'local-optional' },
    { id: 'jobfilter_local', label: 'JobFilter Local', kind: 'local', url: 'http://localhost:3000', expected: 'local-optional' },
    { id: 'github', label: 'GitHub Repo', kind: 'cloud', url: 'https://github.com/manazoid4/mazos-ui', expected: 'external' },
    { id: 'obsidian', label: 'Obsidian Vault', kind: 'vault', path: 'C:/Users/manaz/Desktop/Obsidian Main Vault', expected: 'online' },
  ];
  return Promise.all(services.map(async s => {
    const started = Date.now();
    if (s.kind === 'vault') {
      const online = Boolean(s.path && existsSync(s.path));
      return { ...s, online, status: online ? 'found' : 'missing', latencyMs: 0, signal: online ? 'vault-found' : 'vault-missing', meaning: online ? 'Directory exists; index freshness and content not verified.' : 'Configured vault directory not found on this machine.' };
    }
    try {
      const res = await fetch(s.url!, { signal: AbortSignal.timeout(1400) });
      const online = s.kind === 'cloud' ? res.status < 500 : res.status < 500;
      return { ...s, online, status: res.status, latencyMs: Date.now() - started, signal: online ? 'reachable' : 'degraded', meaning: s.expected === 'external' ? 'Cloud/service link; not localhost process.' : 'Local process endpoint.' };
    } catch (e: any) {
      return { ...s, online: false, status: 0, latencyMs: Date.now() - started, signal: s.expected === 'local-optional' ? 'not-running' : 'offline', meaning: s.expected === 'local-optional' ? 'Not a MazOS failure; start only when needed.' : e.message };
    }
  }));
}
