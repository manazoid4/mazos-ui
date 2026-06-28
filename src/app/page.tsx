'use client';

import { useEffect, useState } from 'react';

export type ActionType = 'scan_vault' | 'email_digest' | 'run_safe_prompt' | 'open_url';

type Button = { 
  id: string; 
  label: string; 
  description: string; 
  category: string; 
  danger_level: string; 
  command_value: string; 
  action_type: ActionType;
  hotkey?: string; 
};
type Data = { mission: string; priority_repos: string[]; toggles: Record<string, boolean>; buttons: Button[] };

const DANGER_COLOR: Record<string, string> = {
  safe: 'var(--green)',
  caution: 'var(--yellow)',
  danger: 'var(--red)',
};

export default function Page() {
  const [data, setData] = useState<Data | null>(null);
  const [active, setActive] = useState<string | null>(null);

  const [output, setOutput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/mazos').then(r => r.json()).then(setData);
  }, []);

  const handleAction = async (btn: Button) => {
    if (btn.action_type === 'open_url') return;
    
    setLoading(true);
    setOutput('Executing...');
    try {
      const res = await fetch('/api/mazos/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(btn)
      });
      const data = await res.json();
      if (data.error) setOutput(`ERROR: ${data.error}`);
      else setOutput(data.output || 'Success');
    } catch (e: any) {
      setOutput(`ERROR: ${e.message}`);
    }
    setLoading(false);
  };

  if (!data) return (
    <div style={{ fontFamily: "'JetBrains Mono'", color: 'var(--accent)', fontSize: 12 }}>
      LOADING MAZ_OS...
    </div>
  );

  const grouped = data.buttons.reduce<Record<string, Button[]>>((acc, b) => {
    (acc[b.category] ??= []).push(b);
    return acc;
  }, {});

  return (
    <>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid var(--line)', paddingBottom: 10, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed'", fontSize: 36, fontWeight: 800, textTransform: 'uppercase', margin: 0, letterSpacing: 1 }}>
            MAZ_OS // CONTROL DECK
          </h1>
          <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
            Local-First Hermes Cockpit
          </div>
        </div>
        <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 12, color: 'var(--accent)', textTransform: 'uppercase' }}>
          MISSION: <span style={{ color: 'var(--ink)' }}>{data.mission}</span>
        </div>
      </header>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 260px', gap: 20 }}>

        {/* Left: Toggles + Repos */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel title="Active Toggles" badge="YAML">
            {Object.entries(data.toggles).map(([k, v]) => (
              <div key={k} style={{
                padding: '5px 10px', background: 'var(--bg)',
                borderLeft: `3px solid ${v ? 'var(--green)' : 'var(--line)'}`,
                fontFamily: "'JetBrains Mono'", fontSize: 10, textTransform: 'uppercase',
                display: 'flex', justifyContent: 'space-between',
                color: v ? 'var(--ink)' : 'var(--muted)',
              }}>
                <span>{k.replace(/_/g, ' ')}</span>
                <span>{v ? 'ON' : 'OFF'}</span>
              </div>
            ))}
          </Panel>

          <Panel title="Repo Priority">
            {data.priority_repos.map((r, i) => (
              <div key={r} style={{
                padding: '5px 10px', background: 'var(--bg)',
                borderLeft: `3px solid ${i === 0 ? 'var(--green)' : 'var(--line)'}`,
                fontFamily: "'JetBrains Mono'", fontSize: 10, textTransform: 'uppercase',
                color: i === 0 ? 'var(--ink)' : 'var(--muted)',
              }}>
                {i + 1}. {r}
              </div>
            ))}
          </Panel>
        </aside>

        {/* Centre: Action Deck */}
        <main style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Object.entries(grouped).map(([cat, btns]) => (
            <Panel key={cat} title={cat}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                {btns.map(b => {
                  const isLink = b.action_type === 'open_url';
                  const innerBtn = (
                    <button key={b.id} onClick={() => !isLink && setActive(b.id === active ? null : b.id)} style={{
                      background: active === b.id ? 'var(--accent)' : 'var(--bg)',
                      border: `2px solid ${active === b.id ? 'var(--accent)' : DANGER_COLOR[b.danger_level] || 'var(--line)'}`,
                      color: active === b.id ? '#000' : 'var(--ink)',
                      padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                      borderRadius: 3, transition: 'all 0.15s',
                      width: '100%',
                    }}>
                      <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 16, fontWeight: 700, textTransform: 'uppercase' }}>
                        {b.label}
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, color: active === b.id ? '#000' : 'var(--muted)', marginTop: 4 }}>
                        {b.description}
                      </div>
                      {b.hotkey && (
                        <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 8, color: active === b.id ? '#333' : 'var(--accent)', marginTop: 6 }}>
                          [{b.hotkey}]
                        </div>
                      )}
                    </button>
                  );
                  return isLink ? (
                    <a key={b.id} href={b.command_value} style={{ textDecoration: 'none' }}>
                      {innerBtn}
                    </a>
                  ) : innerBtn;
                })}
              </div>
            </Panel>
          ))}
        </main>

        {/* Right: Active command */}
        <aside>
          <Panel title="Command Output">
            {active ? (
              <div>
                {(() => {
                  const btn = data.buttons.find(b => b.id === active)!;
                  return (
                    <>
                      <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 18, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>
                        {btn.label}
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, color: 'var(--muted)', marginBottom: 12 }}>
                        {btn.description}
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, background: 'var(--bg)', padding: 10, borderLeft: '3px solid var(--accent)', wordBreak: 'break-all' }}>
                        $ hermes {btn.command_value}
                      </div>
                      
                      {!btn.action_type || btn.action_type !== 'open_url' ? (
                        <button 
                          onClick={() => handleAction(btn)}
                          disabled={loading}
                          style={{
                            marginTop: 12, padding: '8px 12px', background: 'var(--accent)', color: '#000',
                            border: 'none', borderRadius: 4, fontFamily: "'Barlow Condensed'", fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {loading ? 'EXECUTING...' : 'RUN ACTION'}
                        </button>
                      ) : null}

                      {output && (
                        <div style={{ marginTop: 12, fontFamily: "'JetBrains Mono'", fontSize: 10, color: 'var(--ink)', background: 'var(--bg)', padding: 8, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto', border: '1px solid var(--line)' }}>
                          {output}
                        </div>
                      )}

                      <div style={{ marginTop: 12, fontFamily: "'JetBrains Mono'", fontSize: 9, color: 'var(--muted)' }}>
                        DANGER: <span style={{ color: DANGER_COLOR[btn.danger_level] }}>{btn.danger_level.toUpperCase()}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, color: 'var(--muted)' }}>
                Click a button to see its command.
              </div>
            )}
          </Panel>
        </aside>
      </div>
    </>
  );
}

function Panel({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 4, padding: 15 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: 8, marginBottom: 12 }}>
        <h2 style={{ fontFamily: "'Barlow Condensed'", fontSize: 18, textTransform: 'uppercase', margin: 0 }}>{title}</h2>
        {badge && <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, background: 'var(--line)', padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase' }}>{badge}</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}
