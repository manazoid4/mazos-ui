'use client';

import { useEffect, useState } from 'react';
import {
  getDesktopGitStatus,
  getRuntimeStatus,
  listDesktopWorkspaces,
  saveDesktopWorkspaces,
  type DesktopWorkspace,
  type RuntimeStatus,
} from '@/lib/mazos/runtimeClient';

type WorkspaceHealth = { state: 'clean' | 'dirty' | 'error'; detail: string };

function stringifyRegistry(workspaces: DesktopWorkspace[]) {
  return JSON.stringify({ workspaces }, null, 2);
}

function DesktopRepairConsole({ status }: { status: RuntimeStatus }) {
  const [workspaces, setWorkspaces] = useState<DesktopWorkspace[]>([]);
  const [draft, setDraft] = useState(stringifyRegistry([]));
  const [health, setHealth] = useState<Record<string, WorkspaceHealth>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  async function refreshHealth(nextWorkspaces = workspaces) {
    setBusy('health');
    const pairs = await Promise.all(nextWorkspaces.map(async (workspace) => {
      try {
        const output = await getDesktopGitStatus(workspace.id);
        const trimmed = output.trim();
        return [workspace.id, { state: trimmed ? 'dirty' : 'clean', detail: trimmed || 'Working tree clean' }] as const;
      } catch (reason) {
        return [workspace.id, {
          state: 'error',
          detail: reason instanceof Error ? reason.message : String(reason),
        }] as const;
      }
    }));
    setHealth(Object.fromEntries(pairs));
    setBusy('');
  }

  useEffect(() => {
    listDesktopWorkspaces()
      .then((loaded) => {
        setWorkspaces(loaded);
        setDraft(stringifyRegistry(loaded));
        return refreshHealth(loaded);
      })
      .catch((reason: unknown) => {
        setMessage(reason instanceof Error ? reason.message : String(reason));
      });
    // The runtime is fixed for the lifetime of this mounted desktop screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveRegistry() {
    setBusy('save');
    setMessage('');
    try {
      const parsed = JSON.parse(draft) as { workspaces?: DesktopWorkspace[] };
      if (!Array.isArray(parsed.workspaces)) throw new Error('Registry JSON must contain a workspaces array.');
      const saved = await saveDesktopWorkspaces(parsed.workspaces);
      setWorkspaces(saved);
      setDraft(stringifyRegistry(saved));
      setMessage(`Saved ${saved.length} registered workspace${saved.length === 1 ? '' : 's'}.`);
      await refreshHealth(saved);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy('');
    }
  }

  return (
    <main style={{ maxWidth: 980, margin: '5vh auto', padding: 24 }}>
      <p style={{ fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '.12em' }}>MAZos desktop repair gate</p>
      <h1 style={{ fontSize: 42, lineHeight: 1.05, marginBottom: 16 }}>The shell is safe to inspect, but the full local backend is not ready.</h1>
      <p style={{ fontSize: 18, lineHeight: 1.6 }}>
        API-dependent panels are intentionally not mounted. This screen provides only validated workspace registration and read-only Git health while the complete packaged backend is built.
      </p>

      <section style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid currentColor' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h2 style={{ marginBottom: 6 }}>Registered workspaces</h2>
            <small style={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{status.registryPath}</small>
          </div>
          <button type="button" onClick={() => refreshHealth()} disabled={busy !== ''}>
            {busy === 'health' ? 'Checking…' : 'Refresh health'}
          </button>
        </div>

        {workspaces.length === 0 && <p>No workspaces registered. Add existing Git repositories in the JSON editor below.</p>}
        <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
          {workspaces.map((workspace) => {
            const result = health[workspace.id];
            return (
              <article key={workspace.id} style={{ border: '1px solid currentColor', padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <strong>{workspace.label}</strong>
                  <span style={{ fontFamily: 'monospace' }}>{result?.state || 'unchecked'}</span>
                </div>
                <small style={{ display: 'block', marginTop: 6, overflowWrap: 'anywhere' }}>{workspace.path}</small>
                {result && <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 140, overflow: 'auto' }}>{result.detail}</pre>}
              </article>
            );
          })}
        </div>
      </section>

      <section style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid currentColor' }}>
        <h2>Workspace registry</h2>
        <p>Only validated existing Git repositories are saved. Git commands accept registry IDs, not arbitrary renderer paths.</p>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={12}
          spellCheck={false}
          style={{ width: '100%', padding: 12, fontFamily: 'monospace' }}
        />
        <button type="button" onClick={saveRegistry} disabled={busy !== ''} style={{ marginTop: 10 }}>
          {busy === 'save' ? 'Saving…' : 'Validate and save registry'}
        </button>
        {message && <pre style={{ whiteSpace: 'pre-wrap' }}>{message}</pre>}
      </section>

      <section style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid currentColor' }}>
        <h2>Required before release</h2>
        <ul>
          {status.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
        </ul>
      </section>

      <p style={{ marginTop: 28 }}>
        Continue using the Next.js local development mode for the complete current feature set. Do not replace the active MAZos directory or publish another desktop release yet.
      </p>
    </main>
  );
}

export function DesktopRuntimeBoundary({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getRuntimeStatus()
      .then(setStatus)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
      });
  }, []);

  if (error) {
    return (
      <main style={{ maxWidth: 820, margin: '8vh auto', padding: 24 }}>
        <p style={{ fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '.12em' }}>MAZos runtime</p>
        <h1 style={{ fontSize: 36, lineHeight: 1.1 }}>Desktop backend could not start.</h1>
        <p>The application stopped before loading data-dependent panels so the failure would not be hidden.</p>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{error}</pre>
      </main>
    );
  }

  if (!status) {
    return (
      <main style={{ maxWidth: 820, margin: '8vh auto', padding: 24 }}>
        <p style={{ fontFamily: 'monospace' }}>Checking MAZos runtime…</p>
      </main>
    );
  }

  if (status.mode === 'desktop' && !status.standaloneReady) {
    return <DesktopRepairConsole status={status} />;
  }

  return <>{children}</>;
}
