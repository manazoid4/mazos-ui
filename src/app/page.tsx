'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { rankWhatNow } from '@/lib/mazos/commandCentre';
import { buildHandoff } from '@/lib/mazos/handoff';
import { SAFETY_LEVELS, type SafetyLevel } from '@/lib/mazos/safety';
import { buildLoopPrompt, type LoopState, type LoopStopReason } from '@/lib/mazos/loopEngine';
import { buildResolutionPrompt, type DecisionItem } from '@/lib/mazos/decisions';
import { computeStaleFindings, buildBabysitPrompt, type StaleFinding } from '@/lib/mazos/staleRadar';

type Repo = { id:string; label:string; path:string; exists:boolean; branch:string; dirty:boolean; unpushedCount:number; lastModified:string|null; lastCommitIso?:string|null; packageManager:string; scripts:Record<string,string>; buildScript:boolean; lintScript:boolean; github:string };
type Action = { id:string; label:string; description:string; category:string; enabled:boolean; disabledReason?:string; dangerLevel:string; safetyLevel:SafetyLevel; handler?:'command'|'prompt'|'repo'|'vault'; expectedOutput:string; fallbackPrompt:string };
type Run = { success:boolean; actionId:string; label:string; cwd:string; commandPreview:string; stdout:string; stderr:string; exitCode:number|null; startedAt:string; finishedAt:string; durationMs:number; nextSuggestedAction:string };
type Health = { id:string; label:string; kind:string; url?:string; path?:string; online:boolean; status:number|string; latencyMs:number; signal:string; meaning:string };
type Vault = { doctrine:string[]; projectSignals:{name:string;mentions:number}[]; prompts:{source:string;text:string}[]; keyDocs:{source:string;title:string;bullets:string[]}[]; cockpitPanels:string[]; filesSeen:number };
type Data = { mission:string; buttons:Action[]; repos:Repo[]; services:Health[]; runs:Run[]; vault:string };
type DirtyGroups = Record<'app'|'generated'|'submodule'|'docs'|'unknown', string[]>;
type ProjectStatus = { query:string; matchedProject:string|null; resolvedRepoPath:string|null; missing:string[]; latestCommits:string[]; gitStatus:string[]; dirtyGroups:DirtyGroups; currentEntries:string[]; loopState:string[]; warnings:string[]; blocker:string; nextBestAction:string; evidencePathsRead:string[]; latestCommit:string|null; currentBranch:string|null; githubRemote:string|null; verifyCommands:string[] };
type ToolRec = { id:string; name:string; kind:string; localPath:string; useWhen:string; safety:SafetyLevel; readFirst:string; matched:string[]; score:number };
type ShipLogData = { generatedAt:string; days:{day:string;commits:{repo:string;day:string;hash:string;subject:string}[]}[]; counters:{commitsToday:number;commits7d:number;reposActive:number;runsOk:number;runsFail:number}; markdown:string };
type Tab = 'NOW'|'LOOPS'|'PROJECTS'|'INTAKE'|'SYSTEM';

const cats = ['Execute','Repos','Recall','JobFilter','Obsidian','System'];
const TABS: Tab[] = ['NOW','LOOPS','PROJECTS','INTAKE','SYSTEM'];
function SafetyBadge({level}:{level:SafetyLevel}){ const s=SAFETY_LEVELS[level]; return <span className={`safety s${level}`} title={s.meaning}>{level} {s.label}</span> }

export default function Page() {
  const [data,setData]=useState<Data|null>(null), [vault,setVault]=useState<Vault|null>(null), [run,setRun]=useState<Run|null>(null), [busy,setBusy]=useState(''), [modal,setModal]=useState<{title:string;body:React.ReactNode}|null>(null);
  const [ingest,setIngest]=useState({ urls:'', sourceType:'auto', target:'Recall', tags:'', notes:'' }); const [files,setFiles]=useState<FileList|null>(null); const [clock,setClock]=useState('');
  const [projectQuery,setProjectQuery]=useState('JobFilter'), [projectStatus,setProjectStatus]=useState<ProjectStatus|null>(null);
  const [statusDeck,setStatusDeck]=useState<ProjectStatus[]>([]);
  const [routerTask,setRouterTask]=useState(''), [routerRecs,setRouterRecs]=useState<ToolRec[]>([]), [routerBusy,setRouterBusy]=useState(false);
  const [tab,setTab]=useState<Tab>('NOW');
  const [loops,setLoops]=useState<LoopState[]>([]); const [decisions,setDecisions]=useState<DecisionItem[]>([]);
  const [ship,setShip]=useState<ShipLogData|null>(null);
  const [paletteOpen,setPaletteOpen]=useState(false);
  async function refresh(){ const [main,repos,health,runs]=await Promise.all([fetch('/api/mazos').then(r=>r.json()),fetch('/api/mazos/repos').then(r=>r.json()),fetch('/api/mazos/health').then(r=>r.json()),fetch('/api/mazos/runs?limit=8').then(r=>r.json())]); setData({...main, repos:repos.repos, services:health.services, runs:runs.runs, buttons:main.buttons||[]}); }
  async function loadVault(){ const v=await fetch('/api/mazos/vault').then(r=>r.json()); setVault(v); return v; }
  async function loadStatusDeck(){ const names=['JobFilter','Recall','MAZos','Vault']; const statuses=await Promise.all(names.map(name=>fetch(`/api/mazos/project-status?project=${encodeURIComponent(name)}`).then(r=>r.json()))); setStatusDeck(statuses.filter(x=>!x.error)); }
  async function loadLoops(){ const r=await fetch('/api/mazos/loops').then(r=>r.json()); setLoops(r.loops||[]); }
  async function loadDecisions(){ const r=await fetch('/api/mazos/decisions').then(r=>r.json()); setDecisions(r.decisions||[]); }
  async function loadShip(){ const r=await fetch('/api/mazos/shiplog').then(r=>r.json()); setShip(r); }
  async function loopEvent(loopId:string, type:string, extra:Record<string,string>={}){ const r=await fetch('/api/mazos/loops',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({loopId,type,...extra})}).then(r=>r.json()); if(r.loops) setLoops(r.loops); if(type==='gate') loadDecisions(); }
  async function resolveDecision(id:string, status:string, resolution:string){ const r=await fetch('/api/mazos/decisions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'resolve',id,status,resolution})}).then(r=>r.json()); if(r.decisions){ setDecisions(r.decisions); const item=(r.decisions as DecisionItem[]).find(d=>d.id===id); if(item) setModal({title:'Resolution prompt · paste to the waiting agent',body:<CopyBlock text={buildResolutionPrompt(item)}/>}); } }
  async function addDecision(question:string, context:string){ const r=await fetch('/api/mazos/decisions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'open',source:'manual',question,context})}).then(r=>r.json()); if(r.decisions) setDecisions(r.decisions); }
  async function routeTool(){ if(!routerTask.trim())return; setRouterBusy(true); const r=await fetch(`/api/mazos/tool-router?task=${encodeURIComponent(routerTask)}`).then(r=>r.json()); setRouterRecs(r.recommendations||[]); setRouterBusy(false); }
  useEffect(()=>{ document.documentElement.dataset.theme='dark'; const saved=localStorage.getItem('mazos-tab') as Tab|null; if(saved&&TABS.includes(saved)) setTab(saved); refresh(); loadVault(); loadStatusDeck(); loadLoops(); loadDecisions(); loadShip(); const t=setInterval(()=>setClock(new Date().toLocaleTimeString()),1000); return()=>clearInterval(t); },[]);
  useEffect(()=>{ localStorage.setItem('mazos-tab',tab); },[tab]);
  useEffect(()=>{ const h=(e:KeyboardEvent)=>{ if((e.ctrlKey&&e.key.toLowerCase()==='k')||(e.key==='/'&&!(e.target as HTMLElement).closest('input,textarea,select'))){ e.preventDefault(); setPaletteOpen(o=>!o); } if(e.key==='Escape') setPaletteOpen(false); }; window.addEventListener('keydown',h); return()=>window.removeEventListener('keydown',h); },[]);
  const summary=useMemo(()=> data ? { existing:data.repos.filter(r=>r.exists).length, dirty:data.repos.filter(r=>r.dirty).length, optionalDown:data.services.filter(s=>!s.online&&s.signal==='not-running').length, critical:data.services.filter(s=>!s.online&&s.signal!=='not-running').length } : null,[data]);
  const findings=useMemo(()=> data?computeStaleFindings(data.repos):[],[data]);
  const openDecisions=decisions.filter(d=>d.status==='open');
  async function runAction(id:string){ setBusy(id); const r=await fetch('/api/mazos/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})}).then(r=>r.json()); setRun(r); setBusy(''); setModal({title:r.label, body:<Result r={r}/>}); refresh(); }
  async function loadProjectStatus(){ setBusy('project-status'); const r=await fetch(`/api/mazos/project-status?project=${encodeURIComponent(projectQuery)}`).then(r=>r.json()); setBusy(''); if(r.error){ setModal({title:'Project Status',body:r.error}); return; } setProjectStatus(r); }
  async function loadContextPack(project:string){ setBusy('context-pack'); const r=await fetch(`/api/mazos/context-pack?project=${encodeURIComponent(project)}`).then(r=>r.json()); setBusy(''); if(r.error){ setModal({title:'Context Pack',body:r.error}); return; } setModal({title:`Context Pack · ${r.project} · ${r.lines} lines`,body:<div><CopyBlock text={r.markdown}/><p className="muted">Saved: {r.savedTo}</p></div>}); }
  async function doIngest(){ setBusy('ingest'); const fd=new FormData(); Object.entries(ingest).forEach(([k,v])=>fd.append(k,v)); Array.from(files||[]).forEach(f=>fd.append('files',f)); const r=await fetch('/api/mazos/ingest',{method:'POST',body:fd}).then(r=>r.json()); const now=new Date().toISOString(); const rr={success:!!r.success,actionId:'ingest_urls',label:'Ingest Intake',cwd:'api',commandPreview:'POST /api/mazos/ingest',stdout:JSON.stringify(r,null,2),stderr:r.error||'',exitCode:r.success?0:1,startedAt:now,finishedAt:now,durationMs:0,nextSuggestedAction:r.queued?'Open Intake Queue and process queued sources.':'Review routed sources in Recall.'}; setRun(rr); setBusy(''); setModal({title:'Intake Result',body:<Result r={rr}/>}); refresh(); }
  if(!data||!summary) return <main className="shell"><div className="boot">MAZ_OS :: BOOTING COCKPIT…</div></main>;
  const byCat=Object.fromEntries(cats.map(c=>[c,data.buttons.filter(b=>b.category===c)])); const last=run||data.runs?.[0];
  return <main className="shell"><div className="gridGlow" />
    <header className="topbar"><div><p className="eyebrow">JARVIS-LITE LOCAL OPS</p><h1>MAZOS COCKPIT</h1><p className="mission">{data.mission}</p></div><div className="topStats"><b>{clock}</b><span>{summary.existing}/{data.repos.length} repos</span><span>{summary.dirty} dirty</span><span>{summary.optionalDown} optional off</span><span>{summary.critical} critical</span></div></header>
    <nav className="tabs">{TABS.map(t=><button key={t} className={`tabBtn ${tab===t?'active':''}`} onClick={()=>setTab(t)}>{t}{t==='LOOPS'&&openDecisions.length>0&&<span className="tabBadge">{openDecisions.length}</span>}</button>)}<button className="tabBtn paletteHint" onClick={()=>setPaletteOpen(true)}>⌘ Ctrl+K</button></nav>

    {tab==='NOW'&&<>
      <WhatNow data={data} summary={summary} statuses={statusDeck} run={runAction}/>
      <section className="split">
        <Panel title="Loop Status" badge="control tower · click for deck"><div className="loopStrip">{loops.map(l=><button key={l.def.id} className={`loopChip ${l.status}`} onClick={()=>setTab('LOOPS')}><b>{l.def.name}</b><small>{l.status}{l.status!=='idle'?` · ${l.iteration}/${l.def.maxIterations} it · ${l.budgetUsedMinutes}/${l.def.budgetMinutes}m`:''}{l.stopReason?` · ${l.stopReason}`:''}</small></button>)}{loops.length===0&&<p className="muted">Loading loops…</p>}</div></Panel>
        <Panel title="Stale Work Radar" badge={`${findings.length} finding(s) · read-only`}>{findings.length===0?<p className="muted">Nothing stale. All trees clean and pushed.</p>:<div className="findings">{findings.slice(0,3).map((f,i)=><StaleRow key={i} f={f} repos={data.repos} open={setModal}/>)}</div>}{findings.length>3&&<button className="ghost wide" onClick={()=>setTab('PROJECTS')}>All {findings.length} findings → PROJECTS</button>}</Panel>
      </section>
      <Panel title="Last Signal" badge={busy?'running':'summary'}>{last?<Result r={last}/>:<p className="muted">No runs yet.</p>}</Panel>
    </>}

    {tab==='LOOPS'&&<>
      <Panel title="Loop Engineering Deck" badge="prompts out · evidence in · MAZos never executes"><div className="loopDeck">{loops.map(l=><LoopCard key={l.def.id} loop={l} event={loopEvent} open={setModal}/>)}</div></Panel>
      <DecisionInbox decisions={decisions} resolve={resolveDecision} add={addDecision} open={setModal}/>
    </>}

    {tab==='PROJECTS'&&<>
      <Panel title="Project Command Cards" badge="commit · PR · dirty · blocker · next · evidence">
        <div className="repos">{statusDeck.map(s=><ProjectCard key={s.query} status={s} open={setModal} pack={loadContextPack} busy={busy}/>)}</div>
      </Panel>
      <section className="split">
        <Panel title="Ship Log" badge={ship?`${ship.counters.commits7d} commits 7d · ${ship.counters.reposActive} repos · runs ${ship.counters.runsOk}✓/${ship.counters.runsFail}✗`:'loading'}>
          {ship?<><div className="shipCounters"><span><b>{ship.counters.commitsToday}</b> today</span><span><b>{ship.counters.commits7d}</b> 7 days</span><span><b>{ship.counters.reposActive}</b> repos active</span><span><b>{ship.counters.runsOk}</b> runs ok</span><span><b>{ship.counters.runsFail}</b> runs fail</span></div>
          <div className="chips"><button className="primary" style={{width:'auto'}} onClick={()=>{navigator.clipboard.writeText(ship.markdown); setModal({title:'Publishable update copied',body:<CopyBlock text={ship.markdown}/>});}}>COPY PUBLISHABLE UPDATE</button><button className="ghost" onClick={loadShip}>Refresh</button></div>
          <details><summary>preview</summary><pre>{ship.markdown}</pre></details></>:<p className="muted">Loading ship log…</p>}
        </Panel>
        <Panel title="Stale Work Radar — full" badge={`${findings.length} finding(s)`}>{findings.length===0?<p className="muted">Nothing stale.</p>:<div className="findings">{findings.map((f,i)=><StaleRow key={i} f={f} repos={data.repos} open={setModal}/>)}</div>}</Panel>
      </section>
      <Panel title="Latest Project Work" badge="read-only · last 24h"><div className="statusQuery"><input className="input" placeholder="Project name e.g. JobFilter, MAZos, Recall, Hermes" value={projectQuery} onChange={e=>setProjectQuery(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') loadProjectStatus(); }}/><button className="primary" disabled={!projectQuery.trim()||busy==='project-status'} onClick={loadProjectStatus}>{busy==='project-status'?'CHECKING…':'LATEST 24H'}</button></div>{projectStatus&&<ProjectStatusView status={projectStatus}/>}</Panel>
      <section className="split">
        <Panel title="Repo Command Centre" badge="summaries over logs"><div className="repos">{data.repos.map(r=><RepoCard key={r.id} repo={r} run={runAction} open={(m)=>setModal(m)}/>)}</div></Panel>
        <HandoffPanel statuses={statusDeck} open={setModal}/>
      </section>
    </>}

    {tab==='INTAKE'&&<section className="triad">
      <Panel title="Source Intake" badge="writes queue"><textarea className="input big" rows={5} placeholder="Paste YouTube / Instagram / X / web URLs — one per line" value={ingest.urls} onChange={e=>setIngest({...ingest,urls:e.target.value})}/><div className="cols"><select className="input" value={ingest.sourceType} onChange={e=>setIngest({...ingest,sourceType:e.target.value})}>{['auto','youtube','instagram','x','pdf','webpage'].map(x=><option key={x}>{x}</option>)}</select><select className="input" value={ingest.target} onChange={e=>setIngest({...ingest,target:e.target.value})}>{['Recall','Obsidian','JobFilter research'].map(x=><option key={x}>{x}</option>)}</select></div><label className="drop"><input type="file" multiple accept=".pdf,.txt,.md" onChange={e=>setFiles(e.target.files)}/><span>{files?.length?`${files.length} file(s) staged`:'Drop PDFs / notes here'}</span></label><input className="input" placeholder="tags e.g. recall market youtube" value={ingest.tags} onChange={e=>setIngest({...ingest,tags:e.target.value})}/><textarea className="input" rows={2} placeholder="why this matters / extraction goal" value={ingest.notes} onChange={e=>setIngest({...ingest,notes:e.target.value})}/><button className="primary hot" disabled={(!ingest.urls&&!files?.length)||!!busy} onClick={doIngest}>{busy==='ingest'?'ROUTING…':'ROUTE / QUEUE SOURCES'}</button></Panel>
      <Panel title="Vault Intelligence" badge={`${vault?.filesSeen||0} notes · scan writes files`}><div className="intel">{(vault?.doctrine||[]).slice(0,4).map(x=><button key={x} onClick={()=>setModal({title:'Vault Doctrine',body:x})}>{x}</button>)}</div><button className="ghost wide" onClick={()=>setModal({title:'Useful Prompts',body:<PromptList vault={vault}/>})}>Open Prompt Library Summary</button><button className="ghost wide" onClick={()=>loadVault().then(v=>setModal({title:'Vault Scan Complete',body:<PromptList vault={v}/>}))}>Rescan Vault Intel</button></Panel>
      <ToolRouterPanel task={routerTask} setTask={setRouterTask} recs={routerRecs} busy={routerBusy} route={routeTool} open={setModal}/>
    </section>}

    {tab==='SYSTEM'&&<section className="split">
      <div><Panel title="Ops Radar" badge="local + cloud"><div className="radar">{data.services.map(s=><button key={s.id} onClick={()=>setModal({title:s.label,body:<ServiceDetail s={s}/>})} className={`orb ${s.online?'on':'off'} ${s.signal==='not-running'?'idle':''}`}><b>{s.label}</b><span>{s.online?`${s.status} · ${s.latencyMs}ms`:s.signal}</span><small>{s.url||s.path}</small></button>)}</div></Panel>
      <Panel title="Action Matrix" badge="click → summary modal">{cats.map(c=><div key={c} className="actionBlock"><h3>{c}</h3><div className="chips">{(byCat[c] as Action[]).map(a=><ActionLine key={a.id} a={a} run={runAction} busy={busy}/>)}</div></div>)}</Panel></div>
      <Panel title="Run History" badge="last 8">{data.runs?.slice(0,8).map((r,i)=><button className="history" key={i} onClick={()=>setModal({title:r.label,body:<Result r={r}/>})}><span>{r.success?'✓':'✗'} {r.label}</span><small>{new Date(r.finishedAt).toLocaleTimeString()}</small></button>)}{(!data.runs||data.runs.length===0)&&<p className="muted">No runs yet.</p>}</Panel>
    </section>}

    {paletteOpen&&<CommandPalette actions={data.buttons} loops={loops} projects={statusDeck} close={()=>setPaletteOpen(false)} exec={{runAction,setTab,openLoopPrompt:(l:LoopState)=>setModal({title:`Loop prompt · ${l.def.name}`,body:<CopyBlock text={buildLoopPrompt(l.def)}/>})}}/>}
    {modal&&<div className="overlay" onClick={()=>setModal(null)}><section className="modal" onClick={e=>e.stopPropagation()}><div className="panelHead"><h2>{modal.title}</h2><button className="ghost" onClick={()=>setModal(null)}>close</button></div><div>{modal.body}</div></section></div>}
  </main>;
}

function CopyBlock({text}:{text:string}){ return <div><button className="ghost wide" onClick={()=>navigator.clipboard.writeText(text)}>Copy to clipboard</button><pre>{text}</pre></div>; }

function CommandPalette({actions,loops,projects,close,exec}:{actions:Action[];loops:LoopState[];projects:ProjectStatus[];close:()=>void;exec:{runAction:(id:string)=>void;setTab:(t:Tab)=>void;openLoopPrompt:(l:LoopState)=>void}}){
  const [q,setQ]=useState(''); const [sel,setSel]=useState(0); const inputRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{ inputRef.current?.focus(); },[]);
  type Item = { key:string; kind:'tab'|'action'|'loop'|'project'; label:string; hint:string; safety?:SafetyLevel; go:()=>void };
  const items:Item[]=useMemo(()=>{
    const all:Item[]=[
      ...TABS.map(t=>({key:`tab-${t}`,kind:'tab' as const,label:`Go to ${t}`,hint:'tab',go:()=>{exec.setTab(t);close();}})),
      ...actions.map(a=>({key:`act-${a.id}`,kind:'action' as const,label:a.label,hint:`${a.category} · ${a.enabled?a.description:a.disabledReason||'disabled'}`,safety:a.safetyLevel,go:()=>{close();exec.runAction(a.id);}})),
      ...loops.map(l=>({key:`loop-${l.def.id}`,kind:'loop' as const,label:`Loop: ${l.def.name}`,hint:`${l.status} · copy runner prompt`,safety:l.def.safetyCeiling,go:()=>{close();exec.openLoopPrompt(l);}})),
      ...projects.map(p=>({key:`proj-${p.query}`,kind:'project' as const,label:`Project: ${p.matchedProject||p.query}`,hint:p.nextBestAction.slice(0,80),go:()=>{exec.setTab('PROJECTS');close();}})),
    ];
    const needle=q.trim().toLowerCase();
    if(!needle) return all.slice(0,12);
    // simple fuzzy: every query token must appear in label+hint; rank label hits first
    const toks=needle.split(/\s+/);
    return all.map(it=>{ const hay=`${it.label} ${it.hint}`.toLowerCase(); const ok=toks.every(t=>hay.includes(t)); const score=ok?(it.label.toLowerCase().includes(toks[0])?2:1):0; return {it,score}; }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).map(x=>x.it).slice(0,12);
  },[q,actions,loops,projects,close,exec]);
  useEffect(()=>{ setSel(0); },[q]);
  function key(e:React.KeyboardEvent){ if(e.key==='ArrowDown'){e.preventDefault();setSel(s=>Math.min(s+1,items.length-1));} else if(e.key==='ArrowUp'){e.preventDefault();setSel(s=>Math.max(s-1,0));} else if(e.key==='Enter'&&items[sel]){e.preventDefault();items[sel].go();} else if(e.key==='Escape') close(); }
  return <div className="overlay" onClick={close}><section className="palette" onClick={e=>e.stopPropagation()}>
    <input ref={inputRef} className="input" placeholder="Type a command, loop, project, or tab… (Esc closes)" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={key}/>
    <div className="paletteList">{items.map((it,i)=><button key={it.key} className={`paletteRow ${i===sel?'sel':''}`} onMouseEnter={()=>setSel(i)} onClick={it.go}><span className="paletteKind">{it.kind}</span><b>{it.label}</b><small>{it.hint}</small>{it.safety&&<SafetyBadge level={it.safety}/>}</button>)}{items.length===0&&<p className="muted">No match.</p>}</div>
  </section></div>;
}

function LoopCard({loop,event,open}:{loop:LoopState;event:(id:string,type:string,extra?:Record<string,string>)=>void;open:(m:{title:string;body:React.ReactNode})=>void}){
  const d=loop.def; const [note,setNote]=useState(''); const [stopReason,setStopReason]=useState<LoopStopReason>('manual');
  const active=loop.status==='running'||loop.status==='gated';
  return <article className={`repo loopCard ${loop.status}`}>
    <div className="repoTop"><h3>{d.name}</h3><span className={loop.status==='complete'?'ok':loop.status==='stopped'||loop.status==='gated'?'bad':'ok'}>{loop.status}</span></div>
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
    <div className="chips">
      <button className="primary" style={{width:'auto'}} onClick={()=>{const p=buildLoopPrompt(d); navigator.clipboard.writeText(p); open({title:`Loop prompt · ${d.name}`,body:<CopyBlock text={p}/>});}}>COPY LOOP PROMPT</button>
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

function StaleRow({f,repos,open}:{f:StaleFinding;repos:Repo[];open:(m:{title:string;body:React.ReactNode})=>void}){
  const repo=repos.find(r=>r.id===f.repoId);
  return <div className={`finding ${f.severity}`}>
    <div className="repoTop"><b>{f.repoLabel} — {f.title}</b><span className="tag">{f.severity}</span></div>
    <small>{f.evidence}</small>
    <div className="chips">
      <button className="ghost" onClick={()=>{navigator.clipboard.writeText(f.nextCommand); open({title:'Next command copied',body:<CopyBlock text={f.nextCommand}/>});}}>Next command</button>
      <button className="ghost" onClick={()=>{const p=buildBabysitPrompt(f,repo?.path||''); navigator.clipboard.writeText(p); open({title:`Babysit prompt · ${f.repoLabel}`,body:<CopyBlock text={p}/>});}}>Babysit prompt</button>
    </div>
  </div>;
}

function WhatNow({data,summary,statuses,run}:{data:Data;summary:{dirty:number;critical:number;optionalDown:number;existing:number};statuses:ProjectStatus[];run:(id:string)=>void}){
  const ranked=useMemo(()=>rankWhatNow(statuses),[statuses]);
  const top=ranked[0];
  const commits=statuses.reduce((n,s)=>n+s.latestCommits.length,0);
  return <Panel title="What Now" badge="ranked · urgency·blocker·money·freshness">
    <div style={{display:'grid',gridTemplateColumns:'1.25fr .75fr',gap:16}}>
      <section>
        <div className="recommend">{top?.reason || 'Check JobFilter, Recall, then MAZos before starting new work.'}</div>
        <p className="muted">Top priority: <b>{top?.project || 'loading'}</b>{top?<> · score {top.score} (money {top.factors.money} · urgency {top.factors.urgency} · blocker {top.factors.blocker} · fresh {top.factors.freshness})</>:''} · {commits} commit(s)/24h · {summary.dirty} dirty repo(s) · <SafetyBadge level="L1"/> stays on.</p>
        <div className="chips"><button className="primary" style={{width:'auto',minWidth:190}} onClick={()=>run('continue_important_task')}>Get next action prompt</button><button className="ghost" onClick={()=>location.href='/focus'}><b>Focus sprint</b><small>45 min, accountable</small></button><button className="ghost" onClick={()=>run('daily_triage_l1')}><b>Daily Triage L1</b><small>report-only</small></button><button className="ghost" onClick={()=>run('repo_health_scan')}><b>Repo status</b><small>read-only summary</small></button><button className="ghost" onClick={()=>run('github_update_report')}><b>GitHub report prompt</b><small>no push</small></button></div>
      </section>
      <section><h3>Priority stack</h3><ol className="rankList">{ranked.map((r,i)=><li key={r.project}><span className="rankRow"><b>{i+1}. {r.project}</b><span className={`money ${r.moneyLabel}`}>{r.moneyLabel}</span></span><small>{r.reason}</small><small className="dim">score {r.score}</small></li>)}</ol></section>
    </div>
  </Panel>;
}
function ToolRouterPanel({task,setTask,recs,busy,route,open}:{task:string;setTask:(v:string)=>void;recs:ToolRec[];busy:boolean;route:()=>void;open:(m:{title:string;body:React.ReactNode})=>void}){
  return <Panel title="Tool Router" badge="which source to consult · why">
    <div className="statusQuery"><input className="input" placeholder="Describe the task e.g. 'build n8n outreach automation' or 'scrape competitor leads'" value={task} onChange={e=>setTask(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')route();}}/><button className="primary" disabled={!task.trim()||busy} onClick={route}>{busy?'ROUTING…':'ROUTE TASK'}</button></div>
    {recs.length===0?<p className="muted">No recommendation yet. Type a task and route. Registry mirrors external/agent-sources submodules.</p>:
      <div className="recs">{recs.map(r=><button key={r.id} className="recCard" onClick={()=>open({title:`${r.name} · ${r.kind}`,body:<ToolDetail r={r}/>})}><div className="recTop"><b>{r.name}</b><SafetyBadge level={r.safety}/></div><small>{r.useWhen}</small><small className="dim">{r.localPath} · read {r.readFirst} first{r.matched.length?` · matched: ${r.matched.join(', ')}`:''}</small></button>)}</div>}
  </Panel>;
}
function ToolDetail({r}:{r:ToolRec}){ return <div><p>{r.useWhen}</p><dl><dt>kind</dt><dd>{r.kind}</dd><dt>path</dt><dd>{r.localPath}</dd><dt>read first</dt><dd>{r.readFirst}</dd><dt>safety</dt><dd>{r.safety} — {SAFETY_LEVELS[r.safety].meaning}</dd><dt>matched</dt><dd>{r.matched.join(', ')||'name/direct'}</dd></dl><p className="muted">Read the local README/SKILL.md before acting. Do not run installers or bypass auth/ToS.</p></div>; }
function HandoffPanel({statuses,open}:{statuses:ProjectStatus[];open:(m:{title:string;body:React.ReactNode})=>void}){
  const [proj,setProj]=useState(''); const [agent,setAgent]=useState<'Hermes'|'Codex'>('Hermes'); const [safety,setSafety]=useState<SafetyLevel>('L1'); const [task,setTask]=useState('');
  const s=statuses.find(x=>(x.matchedProject||x.query)===proj)||statuses[0];
  function gen(){ if(!s)return; const prompt=buildHandoff({agent,repoPath:s.resolvedRepoPath||'(no resolved repo path)',branch:s.currentBranch||'(unknown branch)',task:task||s.nextBestAction,safety,verifyCommands:s.verifyCommands,evidencePaths:s.evidencePathsRead.slice(0,6)}); open({title:`${agent} Handoff · ${s.matchedProject||s.query} · ${safety}`,body:<CopyBlock text={prompt}/>}); }
  return <Panel title="Handoff Generator" badge="Hermes / Codex · scoped brief">
    <div className="cols"><select className="input" value={proj} onChange={e=>setProj(e.target.value)}>{statuses.length?statuses.map(x=><option key={x.query} value={x.matchedProject||x.query}>{x.matchedProject||x.query}</option>):<option>loading…</option>}</select><select className="input" value={agent} onChange={e=>setAgent(e.target.value as 'Hermes'|'Codex')}>{['Hermes','Codex'].map(a=><option key={a}>{a}</option>)}</select></div>
    <select className="input" value={safety} onChange={e=>setSafety(e.target.value as SafetyLevel)}>{(Object.keys(SAFETY_LEVELS) as SafetyLevel[]).map(l=><option key={l} value={l}>{l} — {SAFETY_LEVELS[l].label}</option>)}</select>
    <textarea className="input" rows={2} placeholder="Task (blank = use project's next best action)" value={task} onChange={e=>setTask(e.target.value)}/>
    <p className="muted">{s?`Repo ${s.resolvedRepoPath||'—'} · branch ${s.currentBranch||'—'} · verify: ${s.verifyCommands.join(', ')||'git status --short'}`:'Load a project first.'}</p>
    <button className="primary hot" disabled={!s} onClick={gen}>GENERATE HANDOFF PROMPT</button>
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
function dirtyLine(label:string, lines:string[]){ return lines.length ? <li key={label}><b>{label}:</b> {lines.slice(0,5).join(' · ')}{lines.length>5?' · …':''}</li> : null; }
function ProjectStatusView({status}:{status:ProjectStatus}){return <div className="projectStatus"><div className="statusMeta"><b>{status.matchedProject||status.query}</b><span>{status.resolvedRepoPath||'Obsidian only'}</span></div>{status.warnings.length>0&&<ul className="summaryList">{status.warnings.map(x=><li className="bad inline" key={x}>{x}</li>)}</ul>}<div className="statusGrid"><section><h3>Latest commits</h3><ul className="summaryList">{(status.latestCommits.length?status.latestCommits:['No commits found in last 24h after checking git.']).slice(0,6).map(x=><li key={x}>{x}</li>)}</ul></section><section><h3>Files / state changed</h3><ul className="summaryList">{status.gitStatus.length?[dirtyLine('App',status.dirtyGroups.app),dirtyLine('Submodule/source',status.dirtyGroups.submodule),dirtyLine('Generated',status.dirtyGroups.generated),dirtyLine('Docs',status.dirtyGroups.docs),dirtyLine('Unknown',status.dirtyGroups.unknown)].filter(Boolean):<li>Git tree clean or repo unavailable.</li>}</ul></section><section><h3>Current blocker</h3><p className="muted">{status.blocker}</p><h3>Next best action</h3><p className="muted">{status.nextBestAction}</p></section><section><h3>Evidence paths read</h3><ul className="summaryList">{status.evidencePathsRead.slice(0,8).map(x=><li key={x}>{x}</li>)}</ul>{status.missing.length>0&&<p className="bad inline">{status.missing.join(' · ')}</p>}</section></div>{status.currentEntries.length>0&&<details><summary>Obsidian CURRENT entries</summary><ul className="summaryList">{status.currentEntries.map(x=><li key={x}>{x}</li>)}</ul></details>}{status.loopState.length>0&&<details><summary>Loop state</summary><ul className="summaryList">{status.loopState.map(x=><li key={x}>{x}</li>)}</ul></details>}</div>}
function RepoCard({repo,run,open}:{repo:Repo;run:(id:string)=>void;open:(m:{title:string;body:React.ReactNode})=>void}){ const fix=`Fix ${repo.label}. Path: ${repo.path}. Inspect first. Run safe status/build/lint only. No destructive commands. Return summary not raw logs.`; return <article className={`repo ${repo.exists?'':'missing'}`}><div className="repoTop"><h3>{repo.label}</h3><span className={repo.dirty?'bad':'ok'}>{repo.exists?(repo.dirty?'dirty':'clean'):'missing'}</span></div><small>{repo.path}</small><dl><dt>branch</dt><dd>{repo.branch}</dd><dt>unpushed</dt><dd>{repo.unpushedCount}</dd><dt>pkg</dt><dd>{repo.packageManager}</dd><dt>scripts</dt><dd>{Object.keys(repo.scripts||{}).slice(0,5).join(', ')||'none'}</dd></dl><div className="chips"><button className="ghost" onClick={()=>run('repo_health_scan')}>Scan</button>{repo.buildScript&&<button className="ghost" onClick={()=>repo.id==='recall'?run('build_recall'):repo.id==='jobfilter'?run('jobfilter_build'):navigator.clipboard.writeText(`cd ${repo.path} && npm run build`)}>Build</button>}{repo.lintScript&&<button className="ghost" onClick={()=>navigator.clipboard.writeText(`cd ${repo.path} && npm run lint`)}>Lint</button>}{repo.github&&<button className="ghost" onClick={()=>open({title:`${repo.label} GitHub`,body:repo.github})}>GitHub</button>}<button className="ghost" onClick={()=>open({title:`${repo.label} Fix Prompt`,body:fix})}>Fix Prompt</button></div></article> }
function ActionLine({a,run,busy}:{a?:Action;run:(id:string)=>void;busy:string}){ if(!a)return null; const mode=a.handler==='command'?'runs command':a.handler==='repo'?'reads repos':a.handler==='vault'?'writes scan files':'manual prompt'; return <button title={a.disabledReason||a.expectedOutput} disabled={!a.enabled||!!busy} onClick={()=>run(a.id)} className="ghost action"><span className="actionHead"><b>{busy===a.id?'… ':''}{a.label}</b>{a.safetyLevel&&<SafetyBadge level={a.safetyLevel}/>}</span><small>{mode} · {a.enabled?a.description:a.disabledReason}</small></button> }
function Result({r}:{r:Run}){ const lines=(r.stdout||r.stderr||'').split('\n').filter(Boolean).slice(0,10); return <div><div className="consoleHead"><b>{r.label}</b><span className={r.success?'ok':'bad'}>{r.success?'OK':'FAIL'}</span></div><p className="muted">{r.commandPreview} · {r.durationMs}ms</p><ul className="summaryList">{lines.map((l,i)=><li key={i}>{l.slice(0,220)}</li>)}</ul><details><summary>raw output</summary><pre>{r.stdout||r.stderr}</pre></details><p className="muted">Next: {r.nextSuggestedAction}</p></div>}
function ServiceDetail({s}:{s:Health}){return <div><p>{s.meaning}</p><dl><dt>kind</dt><dd>{s.kind}</dd><dt>signal</dt><dd>{s.signal}</dd><dt>endpoint</dt><dd>{s.url||s.path}</dd><dt>latency</dt><dd>{s.latencyMs}ms</dd></dl></div>}
function PromptList({vault}:{vault:Vault|null}){return <div><h3>Doctrine</h3><ul className="summaryList">{vault?.doctrine.map(x=><li key={x}>{x}</li>)}</ul><h3>Prompts</h3><ul className="summaryList">{vault?.prompts.slice(0,16).map((p,i)=><li key={i}><b>{p.source}</b> — {p.text}</li>)}</ul></div>}
function Panel({title,badge,children}:{title:string;badge?:string;children:React.ReactNode}){return <section className="panel"><div className="panelHead"><h2>{title}</h2>{badge&&<small>{badge}</small>}</div>{children}</section>}
