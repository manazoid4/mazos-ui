'use client';

import { useEffect, useState } from 'react';

type ProfileSummary = {
  name: string;
  path: string;
  isDefault: boolean;
  active: boolean;
  description: string;
  skillCount: number;
};

type ApiState = {
  profiles: ProfileSummary[];
  active: string;
  selected: string;
  docs: Record<string, string>;
  editableDocs: string[];
};

const LOCAL_BRIDGE = 'http://127.0.0.1:3047';

function shouldUseLocalBridge() {
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'https:' && window.location.hostname.includes('vercel.app');
}

async function mazosFetch(path: string, init?: RequestInit) {
  if (shouldUseLocalBridge()) {
    try {
      const res = await fetch(`${LOCAL_BRIDGE}${path}`, { ...init, cache: 'no-store', signal: AbortSignal.timeout(30_000) });
      if (res.ok) return res;
    } catch {
      // Fall through to hosted API for read-only fallback.
    }
  }
  return fetch(path, init);
}

export default function HermesPage() {
  const [state, setState] = useState<ApiState | null>(null);
  const [viewProfile, setViewProfile] = useState('');
  const [activeDoc, setActiveDoc] = useState('SOUL.md');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  function load(profile?: string) {
    setBusy('load');
    const qs = profile ? `?profile=${encodeURIComponent(profile)}` : '';
    mazosFetch(`/api/mazos/hermes-profile${qs}`)
      .then((res) => res.json())
      .then((data: ApiState) => {
        setState(data);
        setViewProfile(data.selected);
        setDraft(data.docs[activeDoc] ?? '');
      })
      .finally(() => setBusy(''));
  }

  useEffect(() => {
    document.documentElement.dataset.theme = 'dark';
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state) setDraft(state.docs[activeDoc] ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDoc, state]);

  async function switchActive(name: string) {
    if (!confirm(`Set "${name}" as the active Hermes profile? This changes what future Hermes chats/gateway sessions use. Local edit, reversible.`)) return;
    setBusy('switch');
    const res = await mazosFetch('/api/mazos/hermes-profile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'switch', profile: name }),
    });
    const data = await res.json();
    setBusy('');
    if (data.error) { setMessage(`Error: ${data.error}`); return; }
    setMessage(`Active profile is now "${data.active}".`);
    load(viewProfile);
  }

  async function saveDoc() {
    setBusy('save');
    const res = await mazosFetch('/api/mazos/hermes-profile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save-doc', profile: viewProfile, doc: activeDoc, content: draft }),
    });
    const data = await res.json();
    setBusy('');
    if (data.error) { setMessage(`Error: ${data.error}`); return; }
    setMessage(`Saved ${activeDoc} in ${viewProfile}.`);
    load(viewProfile);
  }

  const editableDocs = state?.editableDocs || [];

  return <main className="shell taskShell">
    <header className="topbar">
      <div>
        <p className="eyebrow">AGENT MEMORY</p>
        <h1>Hermes Profiles</h1>
        <p className="mission">View and edit Hermes profile memory (SOUL / MEMORY_INDEX / rules / etc), switch the active profile. Local edit, reversible — no git, no deploy, no email sent from here.</p>
      </div>
      <div className="topStats">
        <b>{state?.active || '...'}</b>
        <span>active profile</span>
      </div>
    </header>

    <nav className="tabs">
      <button className="tabBtn" onClick={() => { location.href = '/'; }}>COCKPIT</button>
      <button className="tabBtn" onClick={() => { location.href = '/sessions'; }}>TASK GATE</button>
      <button className="tabBtn" onClick={() => { location.href = '/openwiki'; }}>OPENWIKI</button>
      <button className="tabBtn active">HERMES</button>
      <button className="tabBtn paletteHint" disabled={busy === 'load'} onClick={() => load(viewProfile)}>{busy === 'load' ? 'LOADING' : 'REFRESH'}</button>
    </nav>

    {message && <p className="ok inline">{message}</p>}

    <section className="split taskGrid">
      <section className="panel">
        <div className="panelHead">
          <h2>Profiles</h2>
          <small>{state?.profiles.length ?? 0} found</small>
        </div>
        <ul className="summaryList">
          {(state?.profiles || []).map((p) => (
            <li key={p.name}>
              <b>{p.name}</b>{p.active && <span className="ok inline"> (active)</span>}
              {p.description && <p className="muted">{p.description}</p>}
              <p className="muted">{p.skillCount} skills — {p.path}</p>
              <div className="chips">
                <button className="ghost" onClick={() => setViewProfile(p.name)} disabled={viewProfile === p.name}>View memory</button>
                <button className="primary" disabled={p.active || busy === 'switch'} onClick={() => switchActive(p.name)}>
                  {p.active ? 'Active' : 'Set Active'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <div className="panelHead">
          <h2>Memory — {viewProfile || '...'}</h2>
          <small>edits write straight to the profile's files on disk</small>
        </div>
        <select className="input" value={activeDoc} onChange={(e) => setActiveDoc(e.target.value)}>
          {editableDocs.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <textarea className="input big" rows={22} value={draft} onChange={(e) => setDraft(e.target.value)} />
        <div className="chips">
          <button className="primary hot" disabled={busy === 'save'} onClick={saveDoc}>{busy === 'save' ? 'SAVING...' : 'Save Doc'}</button>
          <button className="ghost" onClick={() => setDraft(state?.docs[activeDoc] ?? '')}>Revert</button>
        </div>
      </section>
    </section>
  </main>;
}
