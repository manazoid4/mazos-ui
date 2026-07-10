'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SAFETY_LEVELS, type SafetyLevel } from '@/lib/mazos/safety';
import { buildLoopPrompt, type LoopState, type LoopStopReason } from '@/lib/mazos/loopEngine';
import { buildResolutionPrompt, type DecisionItem } from '@/lib/mazos/decisions';

type Repo = { id:string; label:string; path:string; exists:boolean; branch:string; dirty:boolean; unpushedCount:number; lastModified:string|null; lastCommitIso?:string|null; packageManager:string; scripts:Record<string,string>; buildScript:boolean; lintScript:boolean; github:string };
type Action = { id:string; label:string; description:string; category:string; enabled:boolean; disabledReason?:string; dangerLevel:string; safetyLevel:SafetyLevel; handler?:'command'|'prompt'|'repo'|'vault'; expectedOutput:string; fallbackPrompt:string };
type Run = { success:boolean; actionId:string; label:string; cwd:string; commandPreview:string; stdout:string; stderr:string; exitCode:number|null; startedAt:string; finishedAt:string; durationMs:number; nextSuggestedAction:string };
type Health = { id:string; label:string; kind:string; url?:string; path?:string; online:boolean; status:number|string; latencyMs:number; signal:string; meaning:string };
type Data = { mission:string; buttons:Action[]; repos:Repo[]; services:Health[]; runs:Run[]; vault:string };
type DirtyGroups = Record<'app'|'generated'|'submodule'|'docs'|'unknown', string[]>;
type ProjectStatus = { query:string; matchedProject:string|null; resolvedRepoPath:string|null; missing:string[]; latestCommits:string[]; gitStatus:string[]; dirtyGroups:DirtyGroups; currentEntries:string[]; loopState:string[]; warnings:string[]; blocker:string; nextBestAction:string; evidencePathsRead:string[]; latestCommit:string|null; currentBranch:string|null; githubRemote:string|null; verifyCommands:string[] };
type ShipLogData = { generatedAt:string; days:{day:string;commits:{repo:string;day:string;hash:string;subject:string}[]}[]; counters:{commitsToday:number;commits7d:number;reposActive:number;runsOk:number;runsFail:number}; markdown:string };
type SystemInternals = { generatedAt:string; local:boolean; host:string; uptimeHours:number; cpu:{model:string;cores:number;usagePct:number|null}; ram:{totalMb:number;usedMb:number;usedPct:number}; disk:{drive:string;totalGb:number;freeGb:number}|null; gpu:{name:string;vramTotalMb:number;vramUsedMb:number;utilizationPct:number;temperatureC:number}|null; pressure:{ram:boolean;vram:boolean} };
type LoopPatternId = 'auto'|'research-intelligence'|'daily-triage'|'pr-babysitter'|'build-doctor'|'intake-drainer'|'ship-log'|'github-pulse'|'useless-feature-reaper'|'revenue-radar'|'founder-inbox';
type LoopUsefulnessAudit = { score:number; decision:'keep'|'revise'|'merge'|'remove'; label:string; strengths:string[]; gaps:string[]; dimensions:Record<string,number> };
type LoopFactoryDraft = { pattern:Exclude<LoopPatternId,'auto'>; def:LoopState['def']; readinessScore:number; readiness:'ready'|'needs-review'|'unsafe'; warnings:string[]; evidenceRequired:string[]; audit:LoopUsefulnessAudit };
type LoopReceiptSummary = { count:number; latestStatus:string|null; latestAt:string|null; latestEvidence:string|null };
type AuditedLoopState = LoopState & { audit?:LoopUsefulnessAudit; receipts?:LoopReceiptSummary };
type Tab = 'NOW'|'WORK'|'SYSTEM';
type BridgeState = { checked:boolean; available:boolean; url:string; detail:string };

const cats = ['Execute','Repos','Recall','JobFilter','Obsidian','System'];
const TABS: Tab[] = ['NOW','WORK','SYSTEM'];
const LEGACY_TABS: Record<string,Tab> = { FEED:'NOW', LOOPS:'WORK', PROJECTS:'WORK', INBOX:'NOW', INTAKE:'WORK' };
function normalizeTab(saved:string|null):Tab{ if(!saved) return 'NOW'; if(TABS.includes(saved as Tab)) return saved as Tab; return LEGACY_TABS[saved] ?? 'NOW'; }
const LOCAL_BRIDGE = 'http://127.0.0.1:3047';
function SafetyBadge({level}:{level:SafetyLevel}){ const s=SAFETY_LEVELS[level]; return <span className={`safety s${level}`} title={s.meaning}>{level} {s.label}</span> }
function shouldUseLocalBridge() {
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'https:' && window.location.hostname.includes('vercel.app');
}
async function mazosFetch(path:string, init?:RequestInit) {
  if (shouldUseLocalBridge()) {
    try {
      const res = await fetch(`${LOCAL_BRIDGE}${path}`, { ...init, cache:'no-store', signal:AbortSignal.timeout(30_000) });
      if (res.ok) return res;
    } catch { /* fall back to hosted API */ }
  }
  return fetch(path, init);
}
async function bridgeHealth(): Promise<BridgeState> {
  if (!shouldUseLocalBridge()) return { checked:true, available:false, url:LOCAL_BRIDGE, detail:'Local app mode; bridge not needed.' };
  try {
    const res = await fetch(`${LOCAL_BRIDGE}/health`, { cache:'no-store', signal:AbortSignal.timeout(1200) });
    if (!res.ok) throw new Error(`bridge returned ${res.status}`);
    const body = await res.json();
    return { checked:true, available:true, url:LOCAL_BRIDGE, detail:`Connected to ${body.target || 'local MAZos'}.` };
  } catch (error) {
    return { checked:true, available:false, url:LOCAL_BRIDGE, detail:error instanceof Error ? error.message : String(error) };
  }
}

export default function Page() {
  const [data,setData]=useState<Data|null>(null), [busy,setBusy]=useState(''), [modal,setModal]=useState<{title:string;body:React.ReactNode}|null>(null);
  const [statusDeck,setStatusDeck]=useState<ProjectStatus[]>([]);
  const [tab,setTab]=useState<Tab>('NOW');
  const [loops,setLoops]=useState<AuditedLoopState[]>([]); const [decisions,setDecisions]=useState<DecisionItem[]>([]);
  const [loopFactory,setLoopFactory]=useState({ goal:'Research JobFilter competitors weekly and turn what works into product moves.', project:'JobFilter', pattern:'research-intelligence' as LoopPatternId, sources:'' });
  const [loopDraft,setLoopDraft]=useState<LoopFactoryDraft|null>(null);
  const [ship,setShip]=useState<ShipLogData|null>(null);
  const [sys,setSys]=useState<SystemInternals|null>(null);
  const [bridge,setBridge]=useState<BridgeState>({checked:false,available:false,url:LOCAL_BRIDGE,detail:'Checking local bridge...'});
  async function loadSys(){ try{ const r=await mazosFetch('/api/mazos/system').then(r=>r.json()); setSys(r&&r.local?r:null); }catch{ setSys(null); } }
  async function refresh(){ const [main,repos,health,runs]=await Promise.all([mazosFetch('/api/mazos').then(r=>r.json()),mazosFetch('/api/mazos/repos').then(r=>r.json()),mazosFetch('/api/mazos/health').then(r=>r.json()),mazosFetch('/api/mazos/runs?limit=8').then(r=>r.json())]); setData({...main, repos:repos.repos, services:health.services, runs:runs.runs, buttons:main.buttons||[]}); }
  async function loadStatusDeck(){ const names=['JobFilter','Recall','MAZos','Vault']; const statuses=await Promise.all(names.map(name=>mazosFetch(`/api/mazos/project-status?project=${encodeURIComponent(name)}`).then(r=>r.json()))); setStatusDeck(statuses.filter(x=>!x.error)); }
  async function loadLoops(){ const r=await mazosFetch('/api/mazos/loops').then(r=>r.json()); setLoops(r.loops||[]); }
  async function loadDecisions(){ const r=await mazosFetch('/api/mazos/decisions').then(r=>r.json()); setDecisions(r.decisions||[]); }
  async function loadShip(){ const r=await mazosFetch('/api/mazos/shiplog').then(r=>r.json()); setShip(r); }
  async function loopEvent(loopId:string, type:string, extra:Record<string,string>={}){ const r=await mazosFetch('/api/mazos/loops',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({loopId,type,...extra})}).then(r=>r.json()); if(r.loops) setLoops(r.loops); if(type==='gate') loadDecisions(); }
  async function draftLoop(){ setBusy('loop-factory-draft'); const r=await mazosFetch('/api/mazos/loop-factory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...loopFactory,action:'draft'})}).then(r=>r.json()); setLoopDraft(r.draft||null); setBusy(''); }
  async function saveLoop(){ setBusy('loop-factory-save'); const r=await mazosFetch('/api/mazos/loop-factory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...loopFactory,action:'save'})}).then(r=>r.json()); setLoopDraft(r.draft||null); setBusy(''); if(r.ok){ await loadLoops(); setModal({title:'Loop template saved',body:<p className="muted">{r.draft?.def?.name || 'Custom loop'} saved to the Loop Engineering Deck.</p>}); } else { setModal({title:'Loop template not saved',body:<div><p className="bad inline">{r.error || 'Save failed.'}</p>{r.draft&&<CopyBlock text={buildLoopPrompt(r.draft.def)}/>}</div>}); } }
  async function runAction(id:string){ setBusy(id); const r=await mazosFetch('/api/mazos/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})}).then(r=>r.json()); setBusy(''); setModal({title:r.label, body:<Result r={r}/>}); refresh(); }
  async function resolveDecision(id:string, status:string, resolution:string){ const r=await mazosFetch('/api/mazos/decisions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'resolve',id,status,resolution})}).then(r=>r.json()); if(r.decisions){ setDecisions(r.decisions); const item=(r.decisions as DecisionItem[]).find(d=>d.id===id); if(item) setModal({title:'Resolution prompt · paste to the waiting agent',body:<CopyBlock text={buildResolutionPrompt(item)}/>}); } }
  async function addDecision(question:string, context:string){ const r=await mazosFetch('/api/mazos/decisions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'open',source:'manual',question,context})}).then(r=>r.json()); if(r.decisions) setDecisions(r.decisions); }
  async function loadContextPack(project:string){ setBusy('context-pack'); const r=await mazosFetch(`/api/mazos/context-pack?project=${encodeURIComponent(project)}`).then(r=>r.json()); setBusy(''); if(r.error){ setModal({title:'Context Pack',body:r.error}); return; } setModal({title:`Context Pack · ${r.project} · ${r.lines} lines`,body:<div><CopyBlock text={r.markdown}/><p className="muted">Saved: {r.savedTo}</p></div>}); }
  useEffect(()=>{ document.documentElement.dataset.theme='dark'; setTab(normalizeTab(localStorage.getItem('mazos-tab'))); bridgeHealth().then(setBridge); refresh(); loadStatusDeck(); loadLoops(); loadDecisions(); loadShip(); loadSys(); const ts=setInterval(loadSys,30_000); return()=>{clearInterval(ts);}; },[]);
  useEffect(()=>{ localStorage.setItem('mazos-tab',tab); },[tab]);
  const summary=useMemo(()=> data ? { existing:data.repos.filter(r=>r.exists).length, dirty:data.repos.filter(r=>r.dirty).length, optionalDown:data.services.filter(s=>!s.online&&s.signal==='not-running').length, critical:data.services.filter(s=>!s.online&&s.signal!=='not-running').length } : null,[data]);
  const openDecisions=decisions.filter(d=>d.status==='open');
  if(!data||!summary) return <main className="shell"><div className="boot">MAZ_OS :: BOOTING COCKPIT…</div></main>;
  const byCat=Object.fromEntries(cats.map(c=>[c,data.buttons.filter(b=>b.category===c)]));
  return <main className="shell"><div className="gridGlow" />
    <header className="topbar"><div><h1>MAZOS COCKPIT</h1><p className="mission">{data.mission}</p></div><div className="topRight"><div className="topLinks"><a href="/research">RESEARCH</a><a href="/sessions">TASK GATE</a><a href="/openwiki">OPENWIKI</a></div><div className="topStats"><span>{summary.existing}/{data.repos.length} repos</span><span>{summary.dirty} dirty</span><span>{summary.optionalDown} optional off</span><span>{summary.critical} critical</span></div></div></header>
    <SystemStrip sys={sys}/>
    <BridgeBanner bridge={bridge} refreshBridge={()=>bridgeHealth().then(setBridge)}/>
    <nav className="tabs">{TABS.map(t=><button key={t} className={`tabBtn ${tab===t?'active':''}`} onClick={()=>setTab(t)}>{t}{t==='WORK'&&openDecisions.length>0&&<span className="tabBadge">{openDecisions.length}</span>}</button>)}</nav>

    {tab==='NOW'&&<>
      <LoopStrip loops={loops} open={setModal}/>
      <RecentShippedStrip ship={ship} repos={data.repos}/>
      <Panel title="Project Status" badge="commit · branch · dirty · blocker · next"><div className="repos">{statusDeck.map(s=><ProjectCard key={s.query} status={s} open={setModal} pack={loadContextPack} busy={busy}/>)}</div></Panel>
    </>}

    {tab==='WORK'&&<>
      <Panel title="Project Command Cards" badge="commit · PR · dirty · blocker · next · evidence">
        <div className="repos">{statusDeck.map(s=><ProjectCard key={s.query} status={s} open={setModal} pack={loadContextPack} busy={busy}/>)}</div>
      </Panel>
      <LoopFactoryPanel form={loopFactory} setForm={setLoopFactory} draft={loopDraft} busy={busy} draftLoop={draftLoop} saveLoop={saveLoop} open={setModal}/>
      <Panel title="Loop Engineering Deck" badge={deckBadge(loops)}><div className="loopDeck">{loops.map(l=><LoopCard key={l.def.id} loop={l} event={loopEvent} open={setModal}/>)}</div></Panel>
      <DecisionInbox decisions={decisions} resolve={resolveDecision} add={addDecision} open={setModal}/>
    </>}

    {tab==='SYSTEM'&&<section className="split">
      <div><Panel title="Ops Radar" badge="local + cloud"><div className="radar">{data.services.map(s=><button key={s.id} onClick={()=>setModal({title:s.label,body:<ServiceDetail s={s}/>})} className={`orb ${s.online?'on':'off'} ${s.signal==='not-running'?'idle':''}`}><b>{s.label}</b><span>{s.online?`${s.status} · ${s.latencyMs}ms`:s.signal}</span><small>{s.url||s.path}</small></button>)}</div></Panel>
      <Panel title="Action Matrix" badge="click → summary modal">{cats.map(c=><div key={c} className="actionBlock"><h3>{c}</h3><div className="chips">{(byCat[c] as Action[]).map(a=><ActionLine key={a.id} a={a} run={runAction} busy={busy}/>)}</div></div>)}</Panel></div>
      <div><Panel title="Run History" badge="last 8">{data.runs?.slice(0,8).map((r,i)=><button className="history" key={i} onClick={()=>setModal({title:r.label,body:<Result r={r}/>})}><span>{r.success?'✓':'✗'} {r.label}</span><small>{new Date(r.finishedAt).toLocaleTimeString()}</small></button>)}{(!data.runs||data.runs.length===0)&&<p className="muted">No runs yet.</p>}</Panel></div>
    </section>}

    {modal&&<div className="overlay" onClick={()=>setModal(null)}><section className="modal" onClick={e=>e.stopPropagation()}><div className="panelHead"><h2>{modal.title}</h2><button className="ghost" onClick={()=>setModal(null)}>close</button></div><div>{modal.body}</div></section></div>}
  </main>;
}

function BridgeBanner({bridge,refreshBridge}:{bridge:BridgeState;refreshBridge:()=>void}){
  const hosted = shouldUseLocalBridge();
  if (!hosted) return null;
  return <div className={`bridgeBanner ${bridge.available?'on':'off'}`}>
    <div><b>{bridge.available?'Local bridge connected':'Hosted mode needs local bridge'}</b><span>{bridge.available?bridge.detail:'Start local MAZos and the bridge to let this Vercel site read C:\\Users\\manaz paths.'}</span></div>
    <code>npm run dev -- -p 3046</code>
    <code>npm run bridge</code>
    <button className="ghost" onClick={refreshBridge}>Recheck</button>
  </div>;
}

function CopyBlock({text}:{text:string}){ return <div><button className="ghost wide" onClick={()=>navigator.clipboard.writeText(text)}>Copy to clipboard</button><pre>{text}</pre></div>; }
function SystemStrip({sys}:{sys:SystemInternals|null}){
  if(!sys) return null;
  const gb=(mb:number)=>(mb/1024).toFixed(1);
  return <div className="sysStrip" title={`${sys.cpu.model} · snapshot ${new Date(sys.generatedAt).toLocaleTimeString()}`}>
    <span className="sysHost">{sys.host} · up {sys.uptimeHours}h</span>
    <span className={sys.cpu.usagePct!==null&&sys.cpu.usagePct>=90?'sysHot':''}>CPU {sys.cpu.usagePct??'—'}% · {sys.cpu.cores}c</span>
    <span className={sys.pressure.ram?'sysHot':''}>RAM {gb(sys.ram.usedMb)}/{gb(sys.ram.totalMb)} GB · {sys.ram.usedPct}%</span>
    {sys.gpu&&<span className={sys.pressure.vram?'sysHot':''}>VRAM {gb(sys.gpu.vramUsedMb)}/{gb(sys.gpu.vramTotalMb)} GB · GPU {sys.gpu.utilizationPct}% · {sys.gpu.temperatureC}°C</span>}
    {sys.disk&&<span>{sys.disk.drive.replace('\\','')} {sys.disk.freeGb} GB free</span>}
  </div>;
}

function decisionClass(decision?:LoopUsefulnessAudit['decision']){
  return decision==='keep'?'ok':decision==='remove'?'bad':decision==='merge'?'merge':'revise';
}
function deckBadge(loops:AuditedLoopState[]){ const audits=loops.map(l=>l.audit).filter(Boolean) as LoopUsefulnessAudit[]; if(!audits.length) return 'prompts out · evidence in · MAZos never executes'; const avg=Math.round(audits.reduce((sum,a)=>sum+a.score,0)/audits.length); const count=(d:LoopUsefulnessAudit['decision'])=>audits.filter(a=>a.decision===d).length; return `doctor ${avg}/100 avg · ${count('keep')} keep · ${count('revise')} revise · ${count('merge')} merge · ${count('remove')} remove`; }

const LOOP_PATTERN_OPTIONS:[LoopPatternId,string][]=[
  ['research-intelligence','Research intelligence'],
  ['daily-triage','Daily triage'],
  ['pr-babysitter','PR babysitter'],
  ['build-doctor','Build doctor'],
  ['intake-drainer','Intake drainer'],
  ['ship-log','Ship log'],
  ['github-pulse','GitHub pulse'],
  ['useless-feature-reaper','Useless feature reaper'],
  ['revenue-radar','Revenue radar'],
  ['founder-inbox','Founder inbox'],
  ['auto','Auto-pick (last resort)'],
];
const LOOP_PATTERN_HINTS:Record<LoopPatternId,string>={
  'auto':'MAZos guesses the pattern from your goal text.',
  'research-intelligence':'Turn public market/competitor inputs into ranked product moves with source receipts.',
  'daily-triage':'Read state and produce the few priorities that matter now.',
  'pr-babysitter':'Watch PRs and branches until merged or explicitly blocked.',
  'build-doctor':'Repeat build/lint repair with small scoped fixes.',
  'intake-drainer':'Process queued sources one at a time with gates.',
  'ship-log':'Summarize recent shipped work into durable notes.',
  'github-pulse':'Read latest pushes, PRs, checks, and releases before recommending work.',
  'useless-feature-reaper':'Find panels, loops, or features with weak evidence or low product value.',
  'revenue-radar':'Track pricing, funnel, onboarding, and lead-quality gaps.',
  'founder-inbox':'Turn scattered asks into ranked loops, decisions, and receipts.',
};

function LoopFactoryPanel({form,setForm,draft,busy,draftLoop,saveLoop,open}:{form:{goal:string;project:string;pattern:LoopPatternId;sources:string};setForm:(v:{goal:string;project:string;pattern:LoopPatternId;sources:string})=>void;draft:LoopFactoryDraft|null;busy:string;draftLoop:()=>void;saveLoop:()=>void;open:(m:{title:string;body:React.ReactNode})=>void}){
  const update=<K extends keyof typeof form>(key:K,value:(typeof form)[K])=>setForm({...form,[key]:value});
  const canSave=!!draft&&draft.readiness!=='unsafe';
  return <Panel title="Loop Factory" badge="plain goal → reusable loop template · scored before save">
    <div className="split">
      <div>
        <label className="fieldLabel">Pattern (pick first — prevents vague loops)</label>
        <select className="input" value={form.pattern} onChange={e=>update('pattern',e.target.value as LoopPatternId)}>
          {LOOP_PATTERN_OPTIONS.map(([id,label])=><option key={id} value={id}>{label}</option>)}
        </select>
        <small className="muted">{LOOP_PATTERN_HINTS[form.pattern]}</small>
        <label className="fieldLabel">Goal</label>
        <textarea className="input" rows={4} value={form.goal} onChange={e=>update('goal',e.target.value)} placeholder="Research competitors weekly and turn what works into product moves."/>
        <input className="input" value={form.project} onChange={e=>update('project',e.target.value)} placeholder="Project, e.g. JobFilter"/>
        <label className="fieldLabel">Sources</label>
        <textarea className="input" rows={3} value={form.sources} onChange={e=>update('sources',e.target.value)} placeholder="One public URL, source path, or intake note per line."/>
        <div className="chips">
          <button className="primary" disabled={busy==='loop-factory-draft'||!form.goal.trim()} onClick={draftLoop}>{busy==='loop-factory-draft'?'DRAFTING…':'Draft Loop'}</button>
          <button className="ghost" disabled={!canSave||busy==='loop-factory-save'} onClick={saveLoop}>{busy==='loop-factory-save'?'SAVING…':'Save Template'}</button>
          {draft&&<button className="ghost" onClick={()=>{const prompt=buildLoopPrompt(draft.def); navigator.clipboard.writeText(prompt); open({title:`Loop prompt · ${draft.def.name}`,body:<CopyBlock text={prompt}/>});}}>Copy Runner Prompt</button>}
        </div>
      </div>
      <div>
        {!draft?<p className="muted">Draft a loop to see its readiness score, gates, evidence requirements, and reusable runner prompt before it enters the deck.</p>:<article className={`repo loopCard ${draft.readiness}`}>
          <div className="repoTop"><h3>{draft.def.name}</h3><span className={draft.readiness==='ready'?'ok':draft.readiness==='unsafe'?'bad':'tag'}>{draft.readinessScore} · {draft.readiness}</span></div>
          <div className={`doctorMini ${decisionClass(draft.audit.decision)}`}><b>{draft.audit.score}</b><span>{draft.audit.label}</span></div>
          <small>{draft.def.goal}</small>
          <dl>
            <dt>pattern</dt><dd>{draft.pattern}</dd>
            <dt>agent</dt><dd>{draft.def.agent}</dd>
            <dt>safety</dt><dd><SafetyBadge level={draft.def.safetyCeiling}/></dd>
            <dt>stops</dt><dd>max {draft.def.maxIterations} · {draft.def.budgetMinutes}m · no-progress {draft.def.noProgressStop}</dd>
          </dl>
          <p><b>Success:</b> {draft.def.successCondition}</p>
          {draft.warnings.length>0&&<><p className="detailLabel">WARNINGS</p><ul className="summaryList">{draft.warnings.map(w=><li className="bad inline" key={w}>{w}</li>)}</ul></>}
          {draft.audit.gaps.length>0&&<><p className="detailLabel">DOCTOR GAPS</p><ul className="summaryList">{draft.audit.gaps.slice(0,3).map(w=><li key={w}>{w}</li>)}</ul></>}
          <p className="detailLabel">EVIDENCE REQUIRED</p>
          <ul className="summaryList">{draft.evidenceRequired.map(e=><li key={e}>{e}</li>)}</ul>
          <p className="detailLabel">HUMAN GATES</p>
          <ul className="summaryList">{draft.def.humanGates.map(g=><li key={g}>{g}</li>)}</ul>
        </article>}
      </div>
    </div>
  </Panel>;
}

function LoopCard({loop,event,open}:{loop:AuditedLoopState;event:(id:string,type:string,extra?:Record<string,string>)=>void;open:(m:{title:string;body:React.ReactNode})=>void}){
  const d=loop.def; const [note,setNote]=useState(''); const [stopReason,setStopReason]=useState<LoopStopReason>('manual');
  const active=loop.status==='running'||loop.status==='gated';
  return <article className={`repo loopCard ${loop.status}`}>
    <div className="repoTop"><h3>{d.name}</h3><span className={loop.status==='complete'?'ok':loop.status==='stopped'||loop.status==='gated'?'bad':'ok'}>{loop.status}</span></div>
    {loop.audit&&<div className={`doctorMini ${decisionClass(loop.audit.decision)}`}><b>{loop.audit.score}</b><span>{loop.audit.label}</span></div>}
    <small>{d.goal}</small>
    <dl>
      <dt>agent</dt><dd>{d.agent}</dd>
      <dt>safety</dt><dd><SafetyBadge level={d.safetyCeiling}/></dd>
      <dt>iterations</dt><dd>{loop.iteration}/{d.maxIterations}</dd>
      <dt>budget</dt><dd>{loop.budgetUsedMinutes}/{d.budgetMinutes} min</dd>
      <dt>stops</dt><dd title={`max ${d.maxIterations} it · ${d.budgetMinutes}m · no-progress ${d.noProgressStop}`}>max {d.maxIterations} · {d.budgetMinutes}m · no-progress {d.noProgressStop}</dd>
      <dt>gates</dt><dd title={d.humanGates.join(' · ')}>{d.humanGates.length} human gate(s)</dd>
    </dl>
    {loop.lastEvent&&<p className="muted lastEvent">last: {loop.lastEvent.type}{loop.lastEvent.summary?` — ${loop.lastEvent.summary}`:''}{loop.stopReason?` (${loop.stopReason})`:''}</p>}
    {loop.audit?.gaps?.length ? <p className="muted lastEvent">doctor: {loop.audit.gaps[0]}</p> : null}
    {loop.receipts&&<p className="muted lastEvent">receipts: {loop.receipts.count}{loop.receipts.latestStatus?` · ${loop.receipts.latestStatus}`:''}{loop.receipts.latestEvidence?` — ${loop.receipts.latestEvidence}`:''}</p>}
    <div className="chips">
      <button className="primary" style={{width:'auto'}} onClick={()=>{const p=buildLoopPrompt(d); navigator.clipboard.writeText(p); open({title:`Loop prompt · ${d.name}`,body:<CopyBlock text={p}/>});}}>COPY LOOP PROMPT</button>
      <button className="ghost" onClick={async()=>{const r=await mazosFetch(`/api/mazos/loop-receipts?loopId=${encodeURIComponent(d.id)}&limit=12`).then(r=>r.json()); open({title:`Loop receipts · ${d.name}`,body:<CopyBlock text={JSON.stringify(r,null,2)}/>});}}>Receipts</button>
      {!active&&<button className="ghost" onClick={()=>event(d.id,'start')}>Start</button>}
      {active&&<>
        <button className="ghost" disabled={loop.iteration>=d.maxIterations} title={loop.iteration>=d.maxIterations?'Max iterations reached — stop or complete':''} onClick={()=>{event(d.id,'iteration',{summary:note}); setNote('');}}>Log iteration</button>
        <button className="ghost" onClick={()=>{event(d.id,'complete',{summary:note}); setNote('');}}>Complete</button>
        <button className="ghost" onClick={()=>{event(d.id,'stop',{reason:stopReason,summary:note}); setNote('');}}>Stop</button>
        <select className="input slim" value={stopReason} onChange={e=>setStopReason(e.target.value as LoopStopReason)}>{(['manual','done','no-progress','budget'] as LoopStopReason[]).map(r=><option key={r} value={r}>{r}</option>)}</select>
        <button className="ghost" onClick={()=>{event(d.id,'gate',{gateQuestion:note||`${d.name} needs a human decision.`,gateContext:d.humanGates.join('; ')}); setNote('');}}>Gate → inbox</button>
      </>}
    </div>
    {active&&<input className="input slim" placeholder="one-line evidence: what changed this pass / gate question" value={note} onChange={e=>setNote(e.target.value)}/>}
  </article>;
}

function DecisionInbox({decisions,resolve,add,open}:{decisions:DecisionItem[];resolve:(id:string,status:string,resolution:string)=>void;add:(q:string,c:string)=>void;open:(m:{title:string;body:React.ReactNode})=>void}){
  const [q,setQ]=useState(''); const [ctx,setCtx]=useState(''); const [answers,setAnswers]=useState<Record<string,string>>({});
  const openItems=decisions.filter(d=>d.status==='open'); const resolved=decisions.filter(d=>d.status!=='open').slice(0,5);
  return <Panel title="Decision Inbox" badge={`stop & ask · ${openItems.length} open`}>
    <div className="cols"><input className="input" placeholder="New question for the human (you)" value={q} onChange={e=>setQ(e.target.value)}/><input className="input" placeholder="context (optional)" value={ctx} onChange={e=>setCtx(e.target.value)}/></div>
    <button className="ghost wide" disabled={!q.trim()} onClick={()=>{add(q,ctx); setQ(''); setCtx('');}}>File question</button>
    {openItems.length===0?<p className="muted">Inbox zero. No agent is blocked on you.</p>:openItems.map(d=><article key={d.id} className="decision">
      <div className="repoTop"><b>{d.question}</b><span className="tag">{d.source}</span></div>
      {d.context&&<small>{d.context}</small>}
      <input className="input slim" placeholder="answer / condition (optional)" value={answers[d.id]||''} onChange={e=>setAnswers({...answers,[d.id]:e.target.value})}/>
      <div className="chips">
        <button className="ghost" onClick={()=>resolve(d.id,'approved',answers[d.id]||'')}>Approve</button>
        <button className="ghost" onClick={()=>resolve(d.id,'denied',answers[d.id]||'')}>Deny</button>
        <button className="ghost" disabled={!(answers[d.id]||'').trim()} onClick={()=>resolve(d.id,'answered',answers[d.id])}>Answer</button>
      </div>
    </article>)}
    {resolved.length>0&&<details><summary>recently resolved</summary>{resolved.map(d=><button key={d.id} className="history" onClick={()=>open({title:'Resolution prompt',body:<CopyBlock text={buildResolutionPrompt(d)}/>})}><span>{d.status==='approved'?'✓':d.status==='denied'?'✗':'✎'} {d.question}</span><small>{d.resolvedAt?new Date(d.resolvedAt).toLocaleTimeString():''}</small></button>)}</details>}
  </Panel>;
}

function LoopStrip({loops,open}:{loops:AuditedLoopState[];open:(m:{title:string;body:React.ReactNode})=>void}){
  const ready = loops.filter(l => l.status === 'running' || l.status === 'gated');
  const idle  = loops.filter(l => l.status !== 'running' && l.status !== 'gated');
  return <Panel title="Loops" badge={`${loops.length} loops · click to copy runner prompt`}>
    {loops.length === 0 && <p className="muted">No loops in the deck. Create one in the Loop Factory (WORK tab) or load from config/loops.json.</p>}
    <div className="chips">
      {ready.map(l => <button key={l.def.id} className="primary" style={{width:'auto'}} onClick={()=>{const p=buildLoopPrompt(l.def); navigator.clipboard.writeText(p); open({title:`Loop prompt · ${l.def.name}`,body:<CopyBlock text={p}/>});}} title={l.def.goal}><b>{l.def.name}</b><small> {l.status} · {l.iteration}/{l.def.maxIterations}</small></button>)}
      {idle.map(l => <button key={l.def.id} className="ghost" onClick={()=>{const p=buildLoopPrompt(l.def); navigator.clipboard.writeText(p); open({title:`Loop prompt · ${l.def.name}`,body:<CopyBlock text={p}/>});}} title={l.def.goal}><b>{l.def.name}</b><small> {l.status}</small></button>)}
    </div>
  </Panel>;
}

function RecentShippedStrip({ship,repos}:{ship:ShipLogData|null;repos:Repo[]}){
  if(!ship) return <Panel title="Recently Shipped" badge="no data"><p className="muted">Waiting for ship log data.</p></Panel>;
  const commits=ship.days.flatMap(d=>d.commits).slice(0,5);
  if(commits.length===0) return <Panel title="Recently Shipped" badge="no data"><p className="muted">No commits in the last 7 days across tracked repos.</p></Panel>;
  return <Panel title="Recently Shipped" badge={`${ship.counters.commits7d} commit(s) · 7d`}>
    {commits.map((c,i)=>{
      const repo=repos.find(rp=>rp.label.toLowerCase()===c.repo.toLowerCase());
      const link=repo?.github?`${repo.github}/commit/${c.hash}`:null;
      const days=Math.max(0,Math.floor((Date.now()-Date.parse(c.day))/86400000));
      const rel=days===0?'today':days===1?'1d':`${days}d`;
      const row=<><span><span className="tag">{c.repo}</span> {c.subject}</span><small>{rel}</small></>;
      return link
        ? <a key={`${c.hash}-${i}`} className="history" style={{textDecoration:'none'}} href={link} target="_blank" rel="noreferrer">{row}</a>
        : <div key={`${c.hash}-${i}`} className="history">{row}</div>;
    })}
  </Panel>;
}

function ProjectCard({status,open,pack,busy}:{status:ProjectStatus;open:(m:{title:string;body:React.ReactNode})=>void;pack:(project:string)=>void;busy:string}){
  const groups:[string,string[]][]=[['App',status.dirtyGroups.app],['Source',status.dirtyGroups.submodule],['Generated',status.dirtyGroups.generated],['Docs',status.dirtyGroups.docs]];
  const dirtyTotal=status.gitStatus.length;
  return <article className={`repo ${status.resolvedRepoPath?'':'missing'}`}>
    <div className="repoTop"><h3>{status.matchedProject||status.query}</h3><span className={dirtyTotal?'bad':'ok'}>{status.resolvedRepoPath?(dirtyTotal?`${dirtyTotal} dirty`:'clean'):'no repo'}</span></div>
    <small>{status.resolvedRepoPath||'Obsidian / no git repo'}</small>
    <dl>
      <dt>commit</dt><dd title={status.latestCommit||''}>{status.latestCommit||'none in 24h'}</dd>
      <dt>branch</dt><dd>{status.currentBranch||'—'}</dd>
      <dt>reference</dt><dd title={status.githubRemote||''}>{status.githubRemote?<a href={status.githubRemote} target="_blank" rel="noreferrer">{status.githubRemote.replace('https://github.com/','')}</a>:'—'}</dd>
      <dt>verify</dt><dd title={status.verifyCommands.join(' && ')}>{status.verifyCommands.join(' · ')||'git status --short'}</dd>
    </dl>
    <div className="cardBlock"><b>Blocker</b><p className="muted">{status.blocker}</p><b>Next action</b><p className="muted">{status.nextBestAction}</p></div>
    {dirtyTotal>0&&<div className="dirtySplit">{groups.filter(([,l])=>l.length).map(([k,l])=><span key={k} className="tag">{k} {l.length}</span>)}</div>}
    <div className="chips"><button className="ghost" disabled={busy==='context-pack'} onClick={()=>pack(status.matchedProject||status.query)}>{busy==='context-pack'?'…':'Context pack'}</button><button className="ghost" onClick={()=>open({title:`${status.matchedProject||status.query} · evidence`,body:<EvidenceList status={status}/>})}>Evidence</button>{status.githubRemote&&<button className="ghost" onClick={()=>open({title:`${status.matchedProject||status.query} GitHub`,body:status.githubRemote})}>GitHub</button>}</div>
  </article>;
}
function EvidenceList({status}:{status:ProjectStatus}){ return <div><h3>Evidence paths read</h3><ul className="summaryList">{status.evidencePathsRead.map(x=><li key={x}>{x}</li>)}</ul>{status.missing.length>0&&<><h3>Missing</h3><ul className="summaryList">{status.missing.map(x=><li className="bad inline" key={x}>{x}</li>)}</ul></>}<h3>Verify commands</h3><ul className="summaryList">{status.verifyCommands.map(x=><li key={x}>{x}</li>)}</ul></div>; }
function ActionLine({a,run,busy}:{a?:Action;run:(id:string)=>void;busy:string}){ if(!a)return null; const mode=a.handler==='command'?'runs command':a.handler==='repo'?'reads repos':a.handler==='vault'?'writes scan files':'manual prompt'; return <button title={a.disabledReason||a.expectedOutput} disabled={!a.enabled||!!busy} onClick={()=>run(a.id)} className="ghost action"><span className="actionHead"><b>{busy===a.id?'… ':''}{a.label}</b>{a.safetyLevel&&<SafetyBadge level={a.safetyLevel}/>}</span><small>{mode} · {a.enabled?a.description:a.disabledReason}</small></button> }
function Result({r}:{r:Run}){ const lines=(r.stdout||r.stderr||'').split('\n').filter(Boolean).slice(0,10); return <div><div className="consoleHead"><b>{r.label}</b><span className={r.success?'ok':'bad'}>{r.success?'OK':'FAIL'}</span></div><p className="muted">{r.commandPreview} · {r.durationMs}ms</p><ul className="summaryList">{lines.map((l,i)=><li key={i}>{l.slice(0,220)}</li>)}</ul><details><summary>raw output</summary><pre>{r.stdout||r.stderr}</pre></details><p className="muted">Next: {r.nextSuggestedAction}</p></div>}
function ServiceDetail({s}:{s:Health}){return <div><p>{s.meaning}</p><dl><dt>kind</dt><dd>{s.kind}</dd><dt>signal</dt><dd>{s.signal}</dd><dt>endpoint</dt><dd>{s.url||s.path}</dd><dt>latency</dt><dd>{s.latencyMs}ms</dd></dl></div>}
function Panel({title,badge,children}:{title:string;badge?:string;children:React.ReactNode}){return <section className="panel"><div className="panelHead"><h2>{title}</h2>{badge&&<small>{badge}</small>}</div>{children}</section>}