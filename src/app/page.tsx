'use client';

import { useEffect, useMemo, useState } from 'react';

type ActionType = 'scan_vault' | 'email_digest' | 'run_safe_prompt' | 'open_url' | 'agent_task' | 'recall_ingest' | 'custom_command';
type Button = { id: string; label: string; description: string; category: string; danger_level: string; command_value: string; action_type: ActionType; hotkey?: string };
type Agent = { id: string; name: string; description: string; tools: string[]; model: string };
type Plugin = { name: string; kind: string; enabled: boolean; last_used: string };
type Session = { id: string; title: string; source: string; last_active: string };
type Data = { mission: string; priority_repos: string[]; toggles: Record<string, boolean>; buttons: Button[]; agents: Agent[]; plugins?: Plugin[]; sessions?: Session[] };

const DANGER_COLOR: Record<string, string> = { safe: 'var(--green)', caution: 'var(--yellow)', danger: 'var(--red)' };
const TASKS: Button[] = [
  { id: 'last5', label: 'Scan last 5', description: 'Find unfinished/unpushed work', category: 'Agent Tasks', danger_level: 'safe', command_value: 'scan_last_5_sessions', action_type: 'agent_task' },
  { id: 'recall', label: 'Improve Recall', description: 'Audit Recall ingest gaps', category: 'Agent Tasks', danger_level: 'safe', command_value: 'improve_recall', action_type: 'agent_task' },
  { id: 'vault', label: 'Vault index', description: 'Refresh Obsidian memory index', category: 'Agent Tasks', danger_level: 'safe', command_value: 'refresh_vault_index', action_type: 'agent_task' },
  { id: 'unpushed', label: 'Git check', description: 'Find uncommitted/unpushed repos', category: 'Agent Tasks', danger_level: 'safe', command_value: 'git_unpushed_scan', action_type: 'agent_task' },
  { id: 'market', label: 'Market scan', description: 'Create lightweight market-research brief', category: 'Agent Tasks', danger_level: 'safe', command_value: 'market_research_brief', action_type: 'agent_task' },
  { id: 'digest', label: 'Email digest', description: 'Send session HTML digest', category: 'Agent Tasks', danger_level: 'caution', command_value: 'email_digest', action_type: 'email_digest' },
  { id: 'update-github', label: 'Update GitHub', description: 'Status/build/push + show direct URLs', category: 'Agent Tasks', danger_level: 'caution', command_value: 'update_github_repos', action_type: 'agent_task' },
  { id: 'obsidian-immersion', label: 'Obsidian immersion', description: 'Plan vault/tone/prompt immersion', category: 'Agent Tasks', danger_level: 'safe', command_value: 'obsidian_immersion_plan', action_type: 'agent_task' },
];

export default function Page() {
  const [data, setData] = useState<Data | null>(null);
  const [output, setOutput] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [custom, setCustom] = useState('');
  const [recallUrl, setRecallUrl] = useState('');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    Promise.all([
      fetch('/api/mazos').then(r => r.json()),
      fetch('/api/mazos/agents').then(r => r.json()).catch(() => ({ agents: [] }))
    ]).then(([mainData, agentsData]) => setData({ ...mainData, agents: agentsData.agents || [] }));
  }, [theme]);

  const buttons = useMemo(() => [...(data?.buttons || []), ...TASKS], [data]);
  const grouped = buttons.reduce<Record<string, Button[]>>((acc, b) => ((acc[b.category] ??= []).push(b), acc), {});

  async function run(payload: Partial<Button> & Record<string, unknown>) {
    setLoading(true); setOutput('Executing...');
    try {
      const res = await fetch('/api/mazos/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      setOutput(json.output || JSON.stringify(json, null, 2));
    } catch (e: any) { setOutput(`ERROR: ${e.message}`); }
    setLoading(false);
  }

  if (!data) return <div style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>LOADING MAZ_OS...</div>;

  return <>
    <header style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, borderBottom: '3px solid var(--line)', paddingBottom: 12, marginBottom: 18 }}>
      <div><h1 style={{ fontFamily: "'Barlow Condensed'", fontSize: 38, fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>MAZ_OS // AgentOS</h1><small>Mission: {data.mission}</small></div>
      <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={pill}>{theme === 'dark' ? 'LIGHT' : 'DARK'} MODE</button>
    </header>

    <Panel title="Current Sessions" badge={`${data.sessions?.length || 0} live/recent`}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8 }}>
        {(data.sessions || []).map(s => <div key={s.id} style={miniCard}><b>{s.title}</b><small>{s.id} · {s.source} · {s.last_active}</small></div>)}
      </div>
    </Panel>

    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 300px', gap: 18, marginTop: 18 }}>
      <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Panel title="Enabled Plugins + Skills" badge="last use">
          {(data.plugins || []).map(p => <div key={p.kind + p.name} style={row}><span>{p.enabled ? '●' : '○'} {p.name}</span><small>{p.kind} · {p.last_used}</small></div>)}
        </Panel>
        <Panel title="Repos">{data.priority_repos.map((r, i) => <div key={r} style={row}>{i + 1}. {r}</div>)}</Panel>
      </aside>

      <main style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Panel title="Agent Tasks — Run Now" badge="safe cmds">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8 }}>
            {TASKS.map(b => <ActionButton key={b.id} b={b} active={active} setActive={setActive} run={run} />)}
          </div>
        </Panel>
        {Object.entries(grouped).filter(([cat]) => cat !== 'Agent Tasks').map(([cat, btns]) => <Panel key={cat} title={cat}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8 }}>{btns.map(b => <ActionButton key={b.id} b={b} active={active} setActive={setActive} run={run} />)}</div>
        </Panel>)}
      </main>

      <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Panel title="Recall ingest" badge="yt/ig">
          <input value={recallUrl} onChange={e => setRecallUrl(e.target.value)} placeholder="YouTube or Instagram URL" style={input} />
          <button disabled={!recallUrl || loading} onClick={() => run({ action_type: 'recall_ingest', command_value: recallUrl, danger_level: 'safe' })} style={pill}>INCORPORATE</button>
        </Panel>
        <Panel title="Custom command" badge="make own">
          <textarea value={custom} onChange={e => setCustom(e.target.value)} placeholder="Describe/run your command..." style={{ ...input, minHeight: 92 }} />
          <button disabled={!custom || loading} onClick={() => run({ action_type: 'custom_command', command_value: custom, danger_level: 'caution' })} style={pill}>RUN CUSTOM</button>
        </Panel>
        <Panel title="Output">{output ? <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 260, overflow: 'auto', fontSize: 11 }}>{output}</pre> : <small>Pick task.</small>}</Panel>
      </aside>
    </div>
  </>;
}

function ActionButton({ b, active, setActive, run }: { b: Button; active: string | null; setActive: (x: string | null) => void; run: (x: Button) => void }) {
  return <button onClick={() => { setActive(active === b.id ? null : b.id); if (b.action_type !== 'open_url') run(b); }} style={{ ...btn, borderColor: DANGER_COLOR[b.danger_level] || 'var(--line)' }}><b>{b.label}</b><small>{b.description}</small></button>;
}
function Panel({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) { return <section style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: 14 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><h2 style={{ margin: 0, fontFamily: "'Barlow Condensed'", textTransform: 'uppercase' }}>{title}</h2>{badge && <small>{badge}</small>}</div>{children}</section>; }
const row = { padding: 8, background: 'var(--bg)', borderLeft: '3px solid var(--line)', display: 'flex', flexDirection: 'column' as const, gap: 3 };
const miniCard = { ...row, minHeight: 64 };
const btn = { background: 'var(--bg)', color: 'var(--ink)', border: '2px solid var(--line)', borderRadius: 8, padding: 10, textAlign: 'left' as const, cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, gap: 5 };
const pill = { background: 'var(--accent)', color: 'var(--accent-ink)', border: '0', borderRadius: 999, padding: '9px 12px', fontWeight: 800, cursor: 'pointer' };
const input = { width: '100%', background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 8, padding: 10, marginBottom: 8 };
