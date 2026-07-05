import { existsSync } from 'fs';
import { OPENWIKI_PATHS } from './paths';

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
    { id: 'openwiki', label: 'OpenWiki', kind: 'desktop', path: OPENWIKI_PATHS.app, expected: 'local-optional' },
  ];
  return Promise.all(services.map(async s => {
    const started = Date.now();
    if (s.kind === 'vault') return { ...s, online: true, status: 'indexed', latencyMs: 0, signal: 'vault-ready', meaning: 'Local knowledge base exists; use summaries, not raw logs.' };
    if (s.kind === 'desktop') {
      const online = existsSync(OPENWIKI_PATHS.app);
      return { ...s, online, status: online ? 'installed' : 'missing', latencyMs: Date.now() - started, signal: online ? 'desktop-ready' : 'missing', meaning: online ? 'Local desktop knowledge app is installed; open /openwiki for process and database status.' : 'OpenWiki executable was not found.' };
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
