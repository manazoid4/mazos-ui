'use client';

import { useEffect, useMemo, useState } from 'react';

type LatestPage = { id: string; title: string; updatedAt: string | null };
type OpenWikiStatus = {
  generatedAt: string;
  paths: Record<string, string>;
  installed: boolean;
  databaseExists: boolean;
  sourceExists: boolean;
  hermesSourceExists: boolean;
  mazosSubmoduleExists: boolean;
  starterScriptExists: boolean;
  process: { running: boolean; id: string | null; startTime: string | null; path: string | null };
  scheduledTask: { exists: boolean; state: string | null; taskName: string };
  counts: { wikiPages: number; capturedContent: number; weeklyReports: number; reportSections: number; attentionInsights: number };
  latestPages: LatestPage[];
  healthScore: number;
  healthSignals: string[];
  knowledgeGaps: string[];
  mcp: { serverName: string; reminder: string; configSnippet: string };
  safety: { allowShell: boolean; mode: string; reminder: string };
  prompts: { agentContext: string; launchCommand: string; mcpReminder: string };
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
      // Hosted MAZos remains readable even when the local bridge is off.
    }
  }
  return fetch(path, { ...init, cache: 'no-store' });
}

export default function OpenWikiPage() {
  const [status, setStatus] = useState<OpenWikiStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');

  async function load() {
    setBusy(true);
    const res = await mazosFetch('/api/mazos/openwiki');
    setStatus(await res.json());
    setBusy(false);
  }

  useEffect(() => { load(); }, []);

  const healthClass = useMemo(() => {
    if (!status) return 'caution';
    if (status.healthScore >= 80) return 'safe';
    if (status.healthScore >= 55) return 'caution';
    return 'danger';
  }, [status]);

  function copy(label: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    window.setTimeout(() => setCopied(''), 1600);
  }

  if (!status) return <main className="shell"><div className="boot">OPENWIKI :: LOADING LOCAL KNOWLEDGE STATUS...</div></main>;

  return <main className="shell openwikiShell">
    <header className="topbar">
      <div>
        <p className="eyebrow">LOCAL KNOWLEDGE HUB</p>
        <h1>OPENWIKI</h1>
        <p className="mission">A first-class MAZos memory surface for capture, wiki pages, MCP read-only context, and agent handoffs.</p>
      </div>
      <div className="topStats">
        <b>{status.healthScore}/100</b>
        <span>{status.counts.wikiPages} pages</span>
        <span>{status.counts.capturedContent} captures</span>
        <span>{status.process.running ? 'running' : 'stopped'}</span>
        <span>{status.safety.mode}</span>
      </div>
    </header>

    <nav className="tabs">
      <button className="tabBtn" onClick={() => { location.href = '/'; }}>COCKPIT</button>
      <button className="tabBtn" onClick={() => { location.href = '/sessions'; }}>TASK GATE</button>
      <button className="tabBtn active">OPENWIKI</button>
      <button className="tabBtn" onClick={() => { location.href = '/hermes'; }}>HERMES</button>
      <button className="tabBtn paletteHint" disabled={busy} onClick={load}>{busy ? 'REFRESHING' : 'REFRESH'}</button>
    </nav>

    {shouldUseLocalBridge() && <div className="bridgeBanner off">
      <div><b>Hosted mode</b><span>This page reads Windows-local OpenWiki status through the MAZos local bridge when it is running.</span></div>
      <code>npm run dev -- -p 3046</code>
      <code>npm run bridge</code>
    </div>}

    <section className="split">
      <Panel title="OpenWiki Health" badge={`snapshot ${new Date(status.generatedAt).toLocaleTimeString()}`}>
        <div className={`gateScore ${healthClass}`}>
          <b>{status.healthScore}</b>
          <span>{healthClass}</span>
          <small>{status.safety.reminder}</small>
        </div>
        <div className="openwikiStatusGrid">
          <StatusPill label="App" ok={status.installed} detail={status.paths.app} />
          <StatusPill label="Database" ok={status.databaseExists} detail={status.paths.db} />
          <StatusPill label="Process" ok={status.process.running} detail={status.process.running ? `PID ${status.process.id}` : 'Not running'} />
          <StatusPill label="Scheduled Task" ok={status.scheduledTask.exists} detail={status.scheduledTask.state || 'missing'} />
          <StatusPill label="Source" ok={status.sourceExists} detail={status.paths.source} />
          <StatusPill label="Hermes Mirror" ok={status.hermesSourceExists} detail={status.paths.hermesSource} />
        </div>
      </Panel>

      <Panel title="Agent Actions" badge={copied ? `copied ${copied}` : 'prompt-only'}>
        <button className="primary hot" onClick={() => copy('agent context', status.prompts.agentContext)}>COPY HERMES OPENWIKI PROMPT</button>
        <button className="ghost wide" onClick={() => copy('launch command', status.prompts.launchCommand)}>Copy OpenWiki Launch Command</button>
        <button className="ghost wide" onClick={() => copy('MCP reminder', status.prompts.mcpReminder)}>Copy MCP Config Reminder</button>
        <button className="ghost wide" onClick={() => copy('MCP snippet', status.mcp.configSnippet)}>Copy MCP JSON Snippet</button>
        <div className="chips">
          <button className="ghost" onClick={() => window.open('https://github.com/manazoid4/mazos-ui/blob/main/docs/OPENWIKI_LOCAL_INSTALL.md', '_blank', 'noreferrer')}>Open Install Docs</button>
          <button className="ghost" onClick={() => window.open('https://github.com/kdsz001/OpenWiki', '_blank', 'noreferrer')}>Open GitHub Source</button>
        </div>
        <p className="muted">MAZos is not executing shell here. It returns deliberate copyable commands because shell is governed by `config/control-panel.yaml`.</p>
      </Panel>
    </section>

    <section className="triad">
      <Panel title="Knowledge Counts" badge="SQLite read-only">
        <div className="metricGrid">
          <Metric label="Wiki pages" value={status.counts.wikiPages} />
          <Metric label="Captured content" value={status.counts.capturedContent} />
          <Metric label="Weekly reports" value={status.counts.weeklyReports} />
          <Metric label="Attention insights" value={status.counts.attentionInsights} />
        </div>
      </Panel>
      <Panel title="Latest Wiki Pages" badge={`${status.latestPages.length} shown`}>
        {status.latestPages.length === 0 ? <p className="muted">No OpenWiki pages found.</p> : <div className="openwikiList">
          {status.latestPages.map(page => <article key={page.id} className="finding info">
            <div className="repoTop"><b>{page.title}</b><span className="tag">wiki</span></div>
            <small>{page.updatedAt || 'No timestamp'}</small>
          </article>)}
        </div>}
      </Panel>
      <Panel title="Knowledge Gaps" badge="what to improve next">
        {status.knowledgeGaps.length === 0 ? <p className="muted">OpenWiki has the basics covered. Next step is deeper product/project context.</p> : <ul className="summaryList">
          {status.knowledgeGaps.map(gap => <li key={gap}>{gap}</li>)}
        </ul>}
      </Panel>
    </section>

    <section className="split">
      <Panel title="MCP Access" badge={status.mcp.serverName}>
        <p className="muted">{status.mcp.reminder}</p>
        <pre>{status.mcp.configSnippet}</pre>
      </Panel>
      <Panel title="Agent Context Preview" badge="copyable">
        <button className="ghost wide" onClick={() => copy('agent context', status.prompts.agentContext)}>Copy full prompt</button>
        <pre>{status.prompts.agentContext}</pre>
      </Panel>
    </section>
  </main>;
}

function Panel({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return <section className="panel"><div className="panelHead"><h2>{title}</h2>{badge && <small>{badge}</small>}</div>{children}</section>;
}

function StatusPill({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return <div className={`statusPill ${ok ? 'okPill' : 'badPill'}`}>
    <b>{label}</b>
    <span>{ok ? 'ready' : 'missing'}</span>
    <small>{detail}</small>
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="metric">
    <b>{value}</b>
    <span>{label}</span>
  </div>;
}
