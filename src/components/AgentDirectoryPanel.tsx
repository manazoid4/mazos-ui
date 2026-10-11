'use client';
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, ChevronRight, Copy, Monitor, ShieldCheck } from 'lucide-react';
import styles from './AgentDirectoryPanel.module.css';

export type AgentEntry = {
  id: string; label: string; purpose: string; harness: string; device: string;
  state: 'configured' | 'profile-detected' | 'unverified' | 'scheduled-running' | 'scheduled-ready';
  evidence: string; observedAt: string | null; accountSlot?: string;
};

const ALIAS_KEY = 'mazos:agent-aliases:v1';
function readAliases(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(ALIAS_KEY);
    if (!raw) return {};
    const result = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(result).filter(([k, v]) => /^[a-z0-9:-]+$/.test(k) && typeof v === 'string' && v.length <= 36)) as Record<string, string>;
  } catch { return {}; }
}
function stateLabel(state: AgentEntry['state']) {
  switch (state) {
    case 'scheduled-running': return 'Gateway running';
    case 'scheduled-ready': return 'Gateway stopped';
    case 'profile-detected': return 'Profile detected';
    case 'configured': return 'Configured';
    default: return 'Unverified';
  }
}
function displayTime(value: string | null) {
  if (!value) return 'Not observed';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
}

export function AgentDirectoryPanel({
  agents, onHandoff,
}: {
  agents: AgentEntry[] | null;
  onHandoff: (agent: AgentEntry) => void;
}) {
  const [selected, setSelected] = useState('');
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => setAliases(readAliases()), []);
  const entries = agents || [];
  const groups = useMemo(() => [
    { heading: 'Claude accounts', rows: entries.filter(a => a.accountSlot) },
    { heading: 'Local Hermes', rows: entries.filter(a => a.harness === 'Hermes') },
    { heading: 'Other harnesses', rows: entries.filter(a => a.harness !== 'Hermes' && !a.accountSlot) },
  ].filter(g => g.rows.length), [entries]);
  const current = entries.find(a => a.id === selected) || entries[0] || null;
  function saveAlias() {
    if (!current) return;
    const next = { ...aliases };
    const name = draft.trim().slice(0, 36);
    if (name) next[current.id] = name;
    else delete next[current.id];
    try { window.localStorage.setItem(ALIAS_KEY, JSON.stringify(next)); } catch { /* stay in memory */ }
    setAliases(next);
    setEditing(false);
  }
  function copyEvidence() {
    if (!current) return;
    const value = [current.label, 'Harness: ' + current.harness, 'Status: ' + stateLabel(current.state), 'Evidence: ' + current.evidence, 'Observed: ' + displayTime(current.observedAt)].join('\n');
    navigator.clipboard?.writeText(value).then(() => setCopied(true)).catch(() => setCopied(false));
  }

  return <div className={styles.directory}>
    {!agents && <p className={styles.missing}>Local agent directory unavailable. Your current work is unaffected.</p>}
    {agents && !entries.length && <p className={styles.missing}>No agent sources discovered on this machine.</p>}
    <div className={styles.layout}>
      <div className={styles.roster}>
        {groups.map(group => <div key={group.heading}>
          <div className={styles.groupHeading}>{group.heading}<span>{group.rows.length}</span></div>
          {group.rows.map(agent => {
            const active = current?.id === agent.id;
            return <button type="button" key={agent.id} onClick={() => {setSelected(agent.id);setEditing(false);setCopied(false);}} className={active ? styles.rowActive : styles.row} aria-pressed={active}>
              <span className={styles.monogram}>{agent.harness === 'Hermes' ? 'H' : agent.harness === 'Claude Code' ? 'C' : agent.harness.slice(0,1)}</span>
              <span className={styles.rowText}><strong>{aliases[agent.id] || agent.label}</strong><small>{agent.purpose}</small></span>
              <span className={agent.state === 'scheduled-running' ? styles.running : styles.state}>{stateLabel(agent.state)}</span>
              <ChevronRight size={14} aria-hidden="true"/>
            </button>;
          })}
        </div>)}
      </div>
      <div className={styles.detail} aria-live="polite">
        {current ? <>
          <div className={styles.detailTop}><div><span className={styles.eyebrow}>SELECTED AGENT</span><h3>{aliases[current.id] || current.label}</h3></div><Monitor size={19} color="#8a8984"/></div>
          <div className={styles.status}><span className={current.state === 'scheduled-running' ? styles.activeDot : styles.neutralDot}/>{stateLabel(current.state)}</div>
          <p className={styles.detailPurpose}>{current.purpose}</p>
          <dl>
            <div><dt>Harness</dt><dd>{current.harness}</dd></div>
            <div><dt>Machine</dt><dd>{current.device}</dd></div>
            <div><dt>Observed</dt><dd>{displayTime(current.observedAt)}</dd></div>
            <div><dt>Evidence</dt><dd>{current.evidence}</dd></div>
          </dl>
          <div className={styles.actions}>
            <button type="button" onClick={() => onHandoff(current)} className={styles.primary}><ArrowUpRight size={15}/> Prepare mission</button>
            <button type="button" onClick={copyEvidence} className={styles.secondary}><Copy size={14}/>{copied ? 'Copied' : 'Copy status'}</button>
          </div>
          {editing ? <form className={styles.aliasForm} onSubmit={event => {event.preventDefault();saveAlias();}}><label htmlFor="agentAlias">Local display name</label><input id="agentAlias" autoFocus maxLength={36} value={draft} onChange={event=>setDraft(event.target.value)}/><button type="submit"><Check size={13}/> Save</button><button type="button" onClick={() => setEditing(false)}>Cancel</button></form>
            : <button type="button" className={styles.rename} onClick={() => {setDraft(aliases[current.id]||'');setEditing(true);}}>Rename locally</button>}
          <p className={styles.caution}><ShieldCheck size={14}/> An installed profile or running gateway is not proof of an active model session.</p>
        </> : <p className={styles.missing}>Select an agent to inspect its evidence.</p>}
      </div>
    </div>
  </div>;
}
