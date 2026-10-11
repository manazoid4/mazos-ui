'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity, ArrowRight, ArrowUpRight, Check, ChevronRight, Clipboard,
  Command, GitBranch, LockKeyhole, Radio, RefreshCw, ShieldCheck,
  Terminal, Workflow, AlertCircle, Layers3,
} from 'lucide-react';
import styles from './command-center.module.css';

type SpineRow = {
  product: string; productId: string; nextAction: string; objective: string;
  commercialReason: string; blocker: string; blocked: boolean; owner: string;
  safety: string; score: number; handoffPrompt: string; github: string | null;
  branch: string | null; dirty: number; actionSource: string;
};
type Spine = { generatedAt: string; verdict: { product: string; action: string; why: string; owner: string }; rows: SpineRow[] };
type Decision = { id: string; question: string; context: string; status: string; source: string; createdAt: string };
type Repo = { id: string; label: string; exists: boolean; branch: string; dirty: boolean; unpushedCount: number; lastCommitIso: string | null; github: string };
type Run = { id?: string; action?: string; actionId?: string; name?: string; startedAt?: string; endedAt?: string; timestamp?: string; ok?: boolean; success?: boolean };
type Service = { id: string; label: string; kind?: string; online: boolean; signal: string; expected?: string; meaning?: string };
type DashboardData = {
  spine: Spine | null; decisions: Decision[] | null; repos: Repo[] | null;
  runs: Run[] | null; health: Service[] | null; errors: string[]; fetchedAt: string | null;
};
const INITIAL: DashboardData = { spine: null, decisions: null, repos: null, runs: null, health: null, errors: [], fetchedAt: null };
const ENDPOINTS = [
  ['spine', '/api/mazos/shipping-spine'],
  ['decisions', '/api/mazos/decisions'],
  ['repos', '/api/mazos/repos'],
  ['runs', '/api/mazos/runs?limit=7'],
  ['health', '/api/mazos/health'],
] as const;
const AGENTS = [
  { name: 'ILM', role: 'Research & memory', source: 'maz-agents · Hermes', initials: 'IL' },
  { name: 'Scout', role: 'Lead research', source: 'maz-agents · setup to verify', initials: 'SC' },
  { name: 'Codex', role: 'Build & ship', source: 'External coding session', initials: 'CX' },
  { name: 'Claude', role: 'Review & design', source: 'External coding session', initials: 'CL' },
  { name: 'Hermes', role: 'Local routing', source: 'Local profiles', initials: 'HE' },
] as const;
function shortDate(value: string | undefined | null) {
  if (!value) return 'Unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return 'Unknown';
  return parsed.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function SectionLabel({ children, trailing }: { children: React.ReactNode; trailing?: React.ReactNode }) {
  return <div className={styles.sectionLabel}><span>{children}</span>{trailing}</div>;
}
async function loadJson(url: string) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return response.json() as Promise<unknown>;
}
export default function CommandCenterPage() {
  const [data, setData] = useState<DashboardData>(INITIAL);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState('');
  const [target, setTarget] = useState('Codex');
  const [mission, setMission] = useState('');
  const [copyState, setCopyState] = useState('');
  const refresh = useCallback(() => setRefreshKey(n => n + 1), []);

  useEffect(() => {
    let active = true;
    async function run() {
      setLoading(true);
      const results = await Promise.all(ENDPOINTS.map(async ([name, url]) => {
        try { return { name, value: await loadJson(url), error: '' }; }
        catch (error) { return { name, value: null, error: error instanceof Error ? error.message : 'Connection failed' }; }
      }));
      if (!active) return;
      const get = (key: string): unknown => results.find(result => result.name === key)?.value;
      setData({
        spine: (get('spine') as Spine | undefined) || null,
        decisions: ((get('decisions') as { decisions?: Decision[] } | undefined)?.decisions) || null,
        repos: ((get('repos') as { repos?: Repo[] } | undefined)?.repos) || null,
        runs: ((get('runs') as { runs?: Run[] } | undefined)?.runs) || null,
        health: ((get('health') as { services?: Service[] } | undefined)?.services) || null,
        errors: results.filter(result => result.error).map(result => result.name + ': ' + result.error),
        fetchedAt: new Date().toISOString(),
      });
      setLoading(false);
    }
    void run();
    return () => { active = false; };
  }, [refreshKey]);

  const rows = data.spine?.rows || [];
  const openDecisions = (data.decisions || []).filter(item => item.status === 'open');
  const picked = rows.find(row => row.productId === selected) || rows[0];
  const overallConnected = data.errors.length === 0 && !!data.spine;
  const localHealth = (data.health || []).filter(s => s.kind !== 'cloud' && s.expected !== 'external');
  const selectedRepo = data.repos?.filter(r => r.exists).length;

  const brief = useMemo(() => {
    const intent = mission.trim();
    return [
      'MAZos mission — proposed for ' + target + ' (not yet executed)',
      '',
      'REQUEST: ' + (intent || (picked?.nextAction || 'Inspect the current priorities and recommend one bounded action.')),
      picked ? 'PROJECT: ' + picked.product : 'PROJECT: Cross-project triage',
      picked ? 'GOAL: ' + picked.objective : '',
      picked ? 'COMMERCIAL REASON: ' + picked.commercialReason : '',
      '',
      'Read unified-memory-database/INDEX.md first; load only relevant project status and canonical vault context.',
      'Inspect current local branch, open PRs, safety policies and working changes before making changes. Preserve running agents, credentials, and approvals.',
      'Use a small number of cheap specialist subagents only when parallel work helps; choose the frontier model for architecture and final critical review.',
      'Work in an isolated branch/worktree. Make incremental checkpoints with evidence. Run targeted tests and independently review changed paths.',
      'Do not auto-accept security shifts; do not send outreach, deploy, merge, spend money, or change external accounts without explicit approval.',
      'Save a bounded, sourced handoff to unified memory. Report actual changes, exact test results, limitations, and the next approval needed.',
      picked?.handoffPrompt ? '\nEXISTING VERIFIED MAZos HANDOFF:\n' + picked.handoffPrompt : '',
    ].filter(Boolean).join('\n');
  }, [target, mission, picked]);

  async function copy(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); setCopyState(label); }
    catch { setCopyState('Clipboard unavailable — use a secure local session'); }
  }

  return (
    <div className={styles.frame}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}><div className={styles.mark}><span></span><span></span><span></span></div><div><strong>MAZ<span>os</span></strong><small>PERSONAL OPERATIONS</small></div></div>
        <div className={styles.navGroup}>
          <p className={styles.navHead}>WORKSPACE</p>
          <a href="#overview" className={styles.navActive}><Layers3 size={17} /> Overview <span>01</span></a>
          <a href="#dispatch"><Command size={17} /> Dispatch</a>
          <a href="#projects"><GitBranch size={17} /> Projects</a>
          <a href="#agents"><Workflow size={17} /> Agents</a>
          <a href="#approvals"><ShieldCheck size={17} /> Approvals {openDecisions.length > 0 && <b>{openDecisions.length}</b>}</a>
        </div>
        <div className={styles.navGroup}>
          <p className={styles.navHead}>CONNECTED TOOLS</p>
          <Link href="/call-desk"><Terminal size={17} /> Call Desk <ArrowUpRight size={14} /></Link>
          <Link href="/hermes"><Activity size={17} /> Hermes profiles <ArrowUpRight size={14} /></Link>
          <a href="https://github.com/manazoid4/unified-memory-database" target="_blank" rel="noopener noreferrer"><Layers3 size={17} /> Unified Memory <ArrowUpRight size={14} /></a>
        </div>
        <div className={styles.sidebarBottom}><div className={styles.privacy}><LockKeyhole size={16}/><div><b>Local-first workspace</b><span>Nothing is dispatched without you.</span></div></div><p>MAZ WORKS <span>·</span> OPERATOR VIEW</p></div>
      </aside>

      <main className={styles.main} id="overview">
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}>WORKSPACE <ChevronRight size={13} /> COMMAND CENTRE</div>
          <div className={styles.topRight}>
            <span className={styles.dataStatus}><i className={overallConnected ? styles.dotReady : styles.dotMuted}></i>{loading ? 'Checking local sources' : overallConnected ? 'Local APIs responding' : 'Partial / offline data'}</span>
            <button type="button" onClick={refresh} className={styles.refresh} title="Refresh local data" aria-label="Refresh local data"><RefreshCw size={16} className={loading ? styles.rotating : ''}/></button>
          </div>
        </header>

        <div className={styles.content}>
          <div className={styles.heroHeader}><div><p className={styles.kicker}>YOUR OPERATING PICTURE</p><h1>Command <em>centre.</em></h1><p className={styles.lead}>One place to understand the work, brief your agents and make the next decision.</p></div><div className={styles.heroStamp}><Radio size={17}/><span>READ-ONLY BY DEFAULT<small>{shortDate(data.fetchedAt)}</small></span></div></div>

          <div className={styles.metrics}>
            <div><span>PROJECTS IN VIEW</span><strong>{data.spine ? rows.length : '—'}</strong><small>From existing MAZos playbooks</small></div>
            <div><span>NEEDS YOUR DECISION</span><strong>{data.decisions ? openDecisions.length : '—'}</strong><small>Existing approval inbox</small></div>
            <div><span>RECENT RUN RECEIPTS</span><strong>{data.runs ? data.runs.length : '—'}</strong><small>Stored locally · not live sessions</small></div>
            <div><span>REPOS AVAILABLE</span><strong>{typeof selectedRepo === 'number' ? selectedRepo : '—'}</strong><small>Local paths found</small></div>
          </div>

          {data.errors.length > 0 && !loading && <div className={styles.warning}><AlertCircle size={17}/><span>Some local sources could not be read: {data.errors.join(' · ')}. Missing data is never shown as live.</span><button type="button" onClick={refresh}>Retry</button></div>}

          <div className={styles.overviewGrid}>
            <section className={styles.primaryPanel}>
              <SectionLabel trailing={<span>{data.spine ? 'EVIDENCE-LED PRIORITY' : 'AWAITING DATA'}</span>}>01 / WHAT MATTERS NOW</SectionLabel>
              {picked ? <div className={styles.priority}>
                <div className={styles.priorityTitle}><div><span className={styles.eyetag}>{picked.product}</span><span className={styles.eyetag}>{picked.owner} next</span></div><span className={styles.priorityScore}>NEXT ACTION</span></div>
                <h2>{data.spine?.verdict.action || picked.nextAction}</h2>
                <p>{data.spine?.verdict.why || picked.commercialReason}</p>
                <div className={styles.priorityFoot}><span><i className={picked.blocked ? styles.tinyWarn : styles.tinyOk}></i>{picked.blocked ? 'Waiting on blocker' : 'Ready for review'}</span><button type="button" onClick={() => {setSelected(picked.productId); document.getElementById('dispatch')?.scrollIntoView({behavior:'smooth'});}}>Prepare handoff <ArrowRight size={15}/></button></div>
              </div> : <div className={styles.empty}>{loading ? 'Loading verified project priorities…' : 'No project priority available. Check local workspace paths and the MAZos Shipping Spine.'}</div>}
              <div className={styles.projectMini} id="projects">
                <SectionLabel trailing={<span>{rows.length} TRACKED</span>}>PROJECT PIPELINE</SectionLabel>
                {rows.length ? rows.slice(0, 6).map(row =>
                  <button key={row.productId} type="button" className={styles.projectRow} onClick={() => {setSelected(row.productId); document.getElementById('dispatch')?.scrollIntoView({behavior:'smooth'});}}>
                    <span className={styles.projectIcon}><GitBranch size={15}/></span><span className={styles.projectName}><b>{row.product}</b><small>{row.nextAction}</small></span><span className={styles.projectMeta}>{row.blocked ? 'BLOCKED' : row.actionSource === 'playbook-bet' ? 'PLAYBOOK' : 'EVIDENCE'}</span><ChevronRight size={16}/>
                  </button>
                ) : <p className={styles.rowFallback}>No project rows received.</p>}
              </div>
            </section>

            <section className={styles.dispatchPanel} id="dispatch">
              <SectionLabel trailing={<span className={styles.readOnly}><LockKeyhole size={12}/> SAFE HANDOFF</span>}>02 / DIRECT THE WORK</SectionLabel>
              <h2>What should we work on?</h2>
              <p>Write normally. MAZos prepares a scoped, memory-aware mission you can give to an existing agent.</p>
              <label className={styles.srOnly} htmlFor="mission">Mission instruction</label>
              <textarea id="mission" className={styles.composer} placeholder="e.g. Finish the Zawiya Trust demo, run a design review, and show me the risks before deployment…" value={mission} onChange={e => setMission(e.target.value)} maxLength={3000}/>
              <div className={styles.formLine}><label>PROJECT<select value={selected || picked?.productId || ''} onChange={e => setSelected(e.target.value)}><option value="">Current priority</option>{rows.map(row => <option key={row.productId} value={row.productId}>{row.product}</option>)}</select></label><label>AGENT<select value={target} onChange={e => setTarget(e.target.value)}><option>Codex</option><option>Claude</option><option>Hermes</option><option>ILM</option></select></label></div>
              <button className={styles.copyButton} type="button" onClick={() => void copy(brief, 'Mission copied')}><Clipboard size={17}/> Copy mission for {target}<ArrowRight size={17}/></button>
              <div className={styles.copyFeedback} aria-live="polite">{copyState ? <><Check size={14}/>{copyState}</> : <><ShieldCheck size={14}/>Copies a brief; never launches a process or consumes model credits.</>}</div>
              <div className={styles.hint}><span>SMART ROUTING</span><p>Use Astra or Opus for architecture and final review; assign smaller bounded tasks to cheaper models. Actual available models are checked by your coding agent.</p></div>
            </section>
          </div>

          <div className={styles.lowerGrid}>
            <section className={styles.panel} id="agents"><SectionLabel trailing={<span>STATUS ≠ CONFIGURATION</span>}>03 / AGENT DIRECTORY</SectionLabel><h2>Your existing specialists</h2><div className={styles.agents}>{AGENTS.map(a=><div className={styles.agentRow} key={a.name}><span className={styles.avatar}>{a.initials}</span><div><b>{a.name}</b><small>{a.role} · {a.source}</small></div><span className={styles.unverified}>Not live-verified</span></div>)}</div><p className={styles.panelNote}>These identities come from your repos. No heartbeat means no “online” claim; live status integration is the next adapter task.</p></section>
            <section className={styles.panel} id="approvals"><SectionLabel trailing={<span>{openDecisions.length} OPEN</span>}>04 / YOUR APPROVALS</SectionLabel><h2>Nothing important moves silently.</h2>{data.decisions ? (openDecisions.length ? <div className={styles.approvals}>{openDecisions.slice(0,4).map(d=><div className={styles.approval} key={d.id}><span className={styles.approvalDot}></span><div><b>{d.question}</b><small>{d.source} · {shortDate(d.createdAt)}</small></div></div>)}</div>:<p className={styles.clearState}><ShieldCheck size={17}/> No open decisions in the local approval log.</p>) : <p className={styles.rowFallback}>Approval log unavailable.</p>}<p className={styles.panelNote}>Approvals are display-only here. Existing project and safety gates remain authoritative.</p></section>
          </div>
          <div className={styles.footerGrid}><section className={styles.panel}><SectionLabel trailing={<span>NOT AGENT HEARTBEATS</span>}>05 / SERVICE SIGNALS</SectionLabel><div className={styles.signalRows}>{data.health ? localHealth.slice(0,5).map(s=><div key={s.id}><span><i className={s.online ? styles.tinyOk : styles.tinyWarn}></i>{s.label}</span><b>{s.online ? 'Reachable' : s.expected === 'local-optional' ? 'Not running (optional)' : 'Unreachable'}</b></div>):<p className={styles.rowFallback}>Local health check unavailable.</p>}</div></section><section className={styles.panel}><SectionLabel trailing={<span>LOCAL RECEIPTS</span>}>06 / LATEST ACTIVITY</SectionLabel><div className={styles.signalRows}>{data.runs ? data.runs.length ? data.runs.slice(0,4).map((r,i)=><div key={String(r.id || i)}><span><i className={r.success || r.ok ? styles.tinyOk : styles.tinyMuted}></i>{r.action || r.actionId || r.name || 'Recorded action'}</span><b>{shortDate(r.endedAt || r.startedAt || r.timestamp)}</b></div>):<p className={styles.rowFallback}>No run receipts recorded here yet.</p>:<p className={styles.rowFallback}>Run history unavailable.</p>}</div></section></div>

          <footer className={styles.footer}><span>MAZos / PERSONAL CONTROL PLANE</span><span>Evidence before action <span className={styles.footerSep}>·</span> Human approval preserved <span className={styles.footerSep}>·</span> No fabricated telemetry</span></footer>
        </div>
      </main>
    </div>
  );
}
