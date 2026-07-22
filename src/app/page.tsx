'use client';

// MAZos v2 Loop Cockpit: ONE screen, four zones in decision order —
// 1 SHIP NEXT · 2 LOOP DECK · 3 DECISIONS · 4 SHIPPED.
// MAZos never executes agent work; it defines loops, gates them, hands out
// prompts, and captures machine receipts. If a panel doesn't define a loop,
// gate one, show a receipt, or answer "what ships next" — it doesn't exist.

import { useEffect, useRef, useState } from 'react';
import { SAFETY_LEVELS, type SafetyLevel } from '@/lib/mazos/safety';
import { buildLoopPrompt, buildPlanPrompt, type LoopState, type LoopStopReason } from '@/lib/mazos/loopEngine';
import { buildResolutionPrompt, type DecisionItem } from '@/lib/mazos/decisions';

import { ToolkitPanel } from '@/components/ToolkitPanel';
import { StatsStrip } from '@/components/StatsStrip';

type Run = { success:boolean; actionId:string; label:string; cwd:string; commandPreview:string; stdout:string; stderr:string; exitCode:number|null; startedAt:string; finishedAt:string; durationMs:number; nextSuggestedAction:string };
type Health = { id:string; label:string; online:boolean; signal:string; meaning:string };
type Action = { id:string; label:string; description:string; category:string; enabled:boolean; disabledReason?:string; safetyLevel:SafetyLevel; expectedOutput:string };
type SpineRow = { product:string; productId:string; objective:string; nextAction:string; commercialReason:string; evidence:string[]; blocker:string; blocked:boolean; owner:string; moneyLabel:string; score:number; repoPath:string|null; branch:string|null; github:string|null; dirty:number; commits7d:number; handoffPrompt:string };
type Spine = { generatedAt:string; verdict:{product:string; action:string; why:string; owner:string}; rows:SpineRow[] };
type RunReceipt = { at:string; iteration:number; outcome:'pass'|'fail'; verify:{actionId:string; passed:boolean; tail:string}[]; commitRange:{from:string|null; to:string; count:number}|null; diffStat:{files:number; insertions:number; deletions:number}|null; criteriaTampered:boolean; criteriaAllPass:boolean; note:string };
type CockpitLoop = LoopState & { lastRunReceipt?: RunReceipt|null };
type ShipLogData = { days:{day:string; commits:{repo:string; day:string; hash:string; subject:string}[]}[]; counters:{commits7d:number} };
type Repo = { id:string; label:string; github:string };
type FactoryMeta = { repos:string[]; verifyActions:{id:string; label:string}[] };
type Draft = { def:LoopState['def']; gate:{approved:boolean; score:number; riskLevel:string; blockers:string[]; warnings:string[]} };
type BridgeState = { checked:boolean; available:boolean; detail:string };
type Proposal = { goal:string; repo:string; verifyActionId:string; gateScore?:number; riskLevel?:string; blockers?:string[] };
type Ops = {
  scheduler:{registered:boolean; status?:string|null; lastRun?:string|null; lastResult?:string|null; nextRun?:string|null};
  triage:{ran:boolean; lastRun:string|null; findings:number; ageHours:number|null; runs7d:number};
  proposed:{generatedAt:string|null; appOffline:boolean; proposals:Proposal[]};
  loops:{total:number; running:number; gated:number; circuitOpen:number; trusted:number};
  receipts:{week:number; passRate:number|null; last:{loopId:string; at:string; outcome:string}|null};
};

const LOCAL_BRIDGE = 'http://127.0.0.1:3047';
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

function SafetyBadge({level}:{level:SafetyLevel}){ const s=SAFETY_LEVELS[level]; return <span className={`safety s${level}`} title={s.meaning}>{level} {s.label}</span>; }
function CopyBlock({text}:{text:string}){ return <div><button className="ghost wide" onClick={()=>navigator.clipboard.writeText(text)}>Copy to clipboard</button><pre>{text}</pre></div>; }
function Panel({title,badge,children}:{title:string;badge?:string;children:React.ReactNode}){ return <section className="panel"><div className="panelHead"><h2>{title}</h2>{badge&&<small>{badge}</small>}</div>{children}</section>; }
function Result({r}:{r:Run}){ const lines=(r.stdout||r.stderr||'').split('\n').filter(Boolean).slice(0,10); return <div><div className="consoleHead"><b>{r.label}</b><span className={r.success?'ok':'bad'}>{r.success?'OK':'FAIL'}</span></div><p className="muted">{r.commandPreview} · {r.durationMs}ms</p><ul className="summaryList">{lines.map((l,i)=><li key={i}>{l.slice(0,220)}</li>)}</ul><details><summary>raw output</summary><pre>{r.stdout||r.stderr}</pre></details></div>; }

export default function Page() {
  const [mission,setMission]=useState('');
  const [buttons,setButtons]=useState<Action[]>([]);
  const [repos,setRepos]=useState<Repo[]>([]);
  const [health,setHealth]=useState<Health[]>([]);
  const [runs,setRuns]=useState<Run[]>([]);
  const [spine,setSpine]=useState<Spine|null>(null);
  const [loops,setLoops]=useState<CockpitLoop[]>([]);
  const [decisions,setDecisions]=useState<DecisionItem[]>([]);
  const [ship,setShip]=useState<ShipLogData|null>(null);
  const [modal,setModal]=useState<{title:string;body:React.ReactNode}|null>(null);
  const [busy,setBusy]=useState('');
  const [bridge,setBridge]=useState<BridgeState>({checked:false,available:false,detail:''});
  const [factory,setFactory]=useState({goal:'',repo:'mazos_ui',verifyActionId:'verify_mazos',agent:'Claude'});
  const [factoryMeta,setFactoryMeta]=useState<FactoryMeta>({repos:[],verifyActions:[]});
  const [draft,setDraft]=useState<Draft|null>(null);
  const [drawerOpen,setDrawerOpen]=useState(false);
  const [ops,setOps]=useState<Ops|null>(null);
  const [dismissed,setDismissed]=useState<Set<string>>(new Set());
  const drawerRef=useRef<HTMLDivElement>(null);

  async function refresh(){
    const [main,h,r,rp]=await Promise.all([
      mazosFetch('/api/mazos').then(r=>r.json()),
      mazosFetch('/api/mazos/health').then(r=>r.json()),
      mazosFetch('/api/mazos/runs?limit=6').then(r=>r.json()),
      mazosFetch('/api/mazos/repos').then(r=>r.json()),
    ]);
    setMission(main.mission||''); setButtons(main.buttons||[]); setHealth(h.services||[]); setRuns(r.runs||[]); setRepos(rp.repos||[]);
  }
  async function loadSpine(){ try{ setSpine(await mazosFetch('/api/mazos/shipping-spine').then(r=>r.json())); }catch{ setSpine(null); } }
  async function loadLoops(){ const r=await mazosFetch('/api/mazos/loops').then(r=>r.json()); setLoops(r.loops||[]); }
  async function loadDecisions(){ const r=await mazosFetch('/api/mazos/decisions').then(r=>r.json()); setDecisions(r.decisions||[]); }
  async function loadShip(){ setShip(await mazosFetch('/api/mazos/shiplog').then(r=>r.json())); }
  async function loadFactoryMeta(){ try{ const r=await mazosFetch('/api/mazos/loop-factory').then(r=>r.json()); setFactoryMeta({repos:r.repos||[],verifyActions:r.verifyActions||[]}); }catch{} }
  async function loadOps(){ try{ setOps(await mazosFetch('/api/mazos/ops').then(r=>r.json())); }catch{ setOps(null); } }
  async function saveProposal(p:Proposal){ setBusy('proposal'); const r=await mazosFetch('/api/mazos/loop-factory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({goal:p.goal,repo:p.repo,verifyActionId:p.verifyActionId,action:'save'})}).then(r=>r.json()); setBusy(''); if(r.ok){ setDismissed(d=>new Set(d).add(p.goal)); await loadLoops(); } else setModal({title:'Gate blocked the save',body:<p className="bad inline">{r.error}</p>}); }
  async function bridgeHealth(){
    if(!shouldUseLocalBridge()){ setBridge({checked:true,available:false,detail:'local mode'}); return; }
    try{ const res=await fetch(`${LOCAL_BRIDGE}/health`,{cache:'no-store',signal:AbortSignal.timeout(1200)}); const b=await res.json(); setBridge({checked:true,available:res.ok,detail:b.target||'bridge'}); }
    catch{ setBridge({checked:true,available:false,detail:'bridge offline — run start-mazos-stack'}); }
  }

  async function loopPost(payload:Record<string,unknown>){
    const r=await mazosFetch('/api/mazos/loops',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(r=>r.json());
    if(r.loops) setLoops(r.loops);
    return r;
  }
  async function runOpsAction(id:string){ setBusy(id); const r=await mazosFetch('/api/mazos/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})}).then(r=>r.json()); setBusy(''); setModal({title:r.label,body:<Result r={r}/>}); refresh(); }
  async function resolveDecision(id:string,status:string,resolution:string){ const r=await mazosFetch('/api/mazos/decisions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'resolve',id,status,resolution})}).then(r=>r.json()); if(r.decisions){ setDecisions(r.decisions); const item=(r.decisions as DecisionItem[]).find(d=>d.id===id); if(item) setModal({title:'Resolution prompt · paste to the waiting agent',body:<CopyBlock text={buildResolutionPrompt(item)}/>}); } }
  async function loadContextPack(project:string){ setBusy('pack'); const r=await mazosFetch(`/api/mazos/context-pack?project=${encodeURIComponent(project)}`).then(r=>r.json()); setBusy(''); setModal({title:`Context Pack · ${r.project||project}`,body:r.error?<p className="bad inline">{r.error}</p>:<CopyBlock text={r.markdown}/>}); }
  async function draftLoop(){ setBusy('draft'); const r=await mazosFetch('/api/mazos/loop-factory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...factory,action:'draft'})}).then(r=>r.json()); setDraft(r.draft||null); setBusy(''); }
  async function saveLoop(){ setBusy('save'); const r=await mazosFetch('/api/mazos/loop-factory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...factory,action:'save'})}).then(r=>r.json()); setBusy(''); setDraft(r.draft||null); if(r.ok){ setDrawerOpen(false); setDraft(null); await loadLoops(); } else setModal({title:'Gate blocked the save',body:<p className="bad inline">{r.error}</p>}); }

  // Ship Next → New Loop prefill: props/state, not localStorage (the old
  // localStorage handoff was written by a button nothing ever read).
  function newLoopFromRow(row:SpineRow){
    const repoKey=factoryMeta.repos.find(k=>row.repoPath?.toLowerCase().includes(k.replace('_ui','').replace('_','')))||factoryMeta.repos[0]||'mazos_ui';
    const verify=factoryMeta.verifyActions.find(v=>v.id.includes(row.productId))?.id||factoryMeta.verifyActions[0]?.id||'verify_mazos';
    setFactory({goal:row.nextAction,repo:repoKey,verifyActionId:verify,agent:'Claude'});
    setDraft(null); setDrawerOpen(true);
    setTimeout(()=>drawerRef.current?.scrollIntoView({behavior:'smooth'}),50);
  }

  useEffect(()=>{ document.documentElement.dataset.theme='dark'; bridgeHealth(); refresh(); loadSpine(); loadLoops(); loadDecisions(); loadShip(); loadFactoryMeta(); loadOps(); const t=setInterval(loadOps,60_000); return()=>clearInterval(t); },[]);

  const critical=health.filter(s=>!s.online&&s.signal!=='not-running').length;
  const openDecisions=decisions.filter(d=>d.status==='open');
  const opsButtons=buttons.filter(b=>b.category==='Ops');

  return <main className="shell"><div className="gridGlow" />
    <header className="topbar">
      <div><h1>MAZOS · LOOP COCKPIT</h1><p className="mission">{mission||'define loops · gate them · collect receipts · ship'}</p></div>
      <div className="topRight">
        <div className="topLinks"><a href="/hermes">HERMES</a></div>
        <div className="topStats">
          <span title={health.map(s=>`${s.label}: ${s.online?'on':'off'}`).join('\n')} className={critical?'bad inline':'ok'}>{critical?`${critical} down`:'● healthy'}</span>
          {shouldUseLocalBridge()&&<span className={bridge.available?'ok':'bad inline'}>{bridge.available?'bridge on':'bridge off'}</span>}
        </div>
      </div>
    </header>

    {/* 0 ─ OPS: state of everything, one line */}
    {ops&&<div className="chips" style={{padding:'0.4rem 0.75rem',opacity:0.95}}>
      <span className={ops.scheduler.registered?'ok':'bad inline'} title={ops.scheduler.registered?`last: ${ops.scheduler.lastRun||'never'} (result ${ops.scheduler.lastResult||'—'}) · next: ${ops.scheduler.nextRun||'—'}`:'run scripts/register-triage-task.ps1'}>
        ⏰ {ops.scheduler.registered?`auto-triage ${ops.scheduler.status?.toLowerCase()||'ready'} · next ${ops.scheduler.nextRun?.split(' ')[1]||'—'}`:'auto-triage NOT registered'}
      </span>
      <span className={ops.triage.ran&&(ops.triage.ageHours??99)<30?'ok':'bad inline'} title={`runs last 7d: ${ops.triage.runs7d}`}>
        🔍 {ops.triage.ran?`triage ${ops.triage.ageHours}h ago · ${ops.triage.findings} findings`:'triage never ran'}
      </span>
      <span className={ops.loops.circuitOpen?'bad inline':'ok'}>
        ∞ {ops.loops.running} running · {ops.loops.gated} gated{ops.loops.circuitOpen?` · ${ops.loops.circuitOpen} circuit-open`:''} · {ops.loops.trusted}★
      </span>
      <span className={ops.receipts.passRate!==null&&ops.receipts.passRate<80?'bad inline':'ok'}>
        🧾 {ops.receipts.week} receipts/7d{ops.receipts.passRate!==null?` · ${ops.receipts.passRate}% pass`:''}
      </span>
      <button className="ghost" disabled={busy==='run_triage'} title="Headless triage now (bounded 20min)" onClick={()=>runOpsAction('run_triage')}>{busy==='run_triage'?'TRIAGING…':'▶ Run triage'}</button>
    </div>}

    {/* 1 ─ SHIP NEXT */}
    <Panel title="Ship Next" badge={spine?`verdict: ${spine.verdict.product} — ${spine.verdict.action}`:'loading spine…'}>
      {!spine&&<p className="muted">Waiting for shipping spine.</p>}
      {spine&&spine.rows.map(row=><article key={row.productId} className={`repo ${row.blocked?'missing':''}`}>
        <div className="repoTop"><h3>{row.product}</h3><span className={row.blocked?'bad':'ok'}>{row.blocked?'blocked':row.moneyLabel==='high'?'£ high':row.moneyLabel}</span></div>
        <small>{row.objective}</small>
        <div className="cardBlock"><b>Next</b><p className="muted">{row.nextAction}</p>{row.blocker&&!/^no blocker/i.test(row.blocker)&&<><b>Blocker</b><p className="muted">{row.blocker}</p></>}</div>
        <dl><dt>evidence</dt><dd title={row.evidence.join('\n')}>{row.evidence[0]||'—'}</dd><dt>repo</dt><dd>{row.branch?`${row.branch} · ${row.dirty} dirty · ${row.commits7d} commits/7d`:'no repo'}</dd></dl>
        <div className="chips">
          <button className="ghost" disabled={busy==='pack'} onClick={()=>loadContextPack(row.product)}>Context pack</button>
          <button className="primary" style={{width:'auto'}} onClick={()=>newLoopFromRow(row)}>→ New Loop</button>
          <button className="ghost" onClick={()=>setModal({title:`${row.product} · handoff prompt`,body:<CopyBlock text={row.handoffPrompt}/>})}>Handoff</button>
        </div>
      </article>)}
    </Panel>

    {/* 2 ─ LOOP DECK */}
    <Panel title="Loop Deck" badge={`${loops.length} loops · receipts are machine-filled · no receipt = didn't happen`}>
      {ops&&ops.proposed.proposals.filter(p=>!dismissed.has(p.goal)).length>0&&<div className="cardBlock">
        <b>Proposed by triage{ops.proposed.appOffline?' (app was offline — no gate scores)':''}</b>
        {ops.proposed.proposals.filter(p=>!dismissed.has(p.goal)).map(p=><div key={p.goal} className="history" style={{alignItems:'center'}}>
          <span title={(p.blockers||[]).join('\n')}>{p.goal} <small className="muted">{p.repo} · {p.verifyActionId}{p.gateScore!==undefined?` · gate ${p.gateScore}`:''}</small></span>
          <span className="chips">
            <button className="ghost" disabled={busy==='proposal'} onClick={()=>saveProposal(p)}>Save</button>
            <button className="ghost" onClick={()=>setDismissed(d=>new Set(d).add(p.goal))}>Dismiss</button>
          </span>
        </div>)}
      </div>}
      <div className="loopDeck">{loops.map(l=><LoopCard key={l.def.id} loop={l} post={loopPost} open={setModal} onGate={loadDecisions}/>)}</div>
      <div ref={drawerRef}>
        {!drawerOpen&&<button className="ghost wide" onClick={()=>setDrawerOpen(true)}>+ New Loop</button>}
        {drawerOpen&&<article className="repo">
          <div className="repoTop"><h3>New Loop</h3><button className="ghost" onClick={()=>{setDrawerOpen(false);setDraft(null);}}>close</button></div>
          <label className="fieldLabel">Goal (one sentence, objectively checkable)</label>
          <textarea className="input" rows={2} value={factory.goal} onChange={e=>setFactory({...factory,goal:e.target.value})} placeholder="Ship one lead-to-paid conversion fix on /find-jobs"/>
          <div className="cols">
            <div><label className="fieldLabel">Repo</label><select className="input" value={factory.repo} onChange={e=>setFactory({...factory,repo:e.target.value})}>{factoryMeta.repos.map(k=><option key={k} value={k}>{k}</option>)}</select></div>
            <div><label className="fieldLabel">Verify action (required — the mechanical gate)</label><select className="input" value={factory.verifyActionId} onChange={e=>setFactory({...factory,verifyActionId:e.target.value})}>{factoryMeta.verifyActions.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></div>
            <div><label className="fieldLabel">Agent</label><select className="input" value={factory.agent} onChange={e=>setFactory({...factory,agent:e.target.value})}>{['Claude','Hermes','Codex'].map(a=><option key={a} value={a}>{a}</option>)}</select></div>
          </div>
          <div className="chips">
            <button className="primary" disabled={busy==='draft'||!factory.goal.trim()} onClick={draftLoop}>{busy==='draft'?'GATING…':'Draft + Gate'}</button>
            <button className="ghost" disabled={!draft||!draft.gate.approved||busy==='save'} title={draft&&!draft.gate.approved?draft.gate.blockers[0]:''} onClick={saveLoop}>{busy==='save'?'SAVING…':'Save Loop'}</button>
          </div>
          {draft&&<div className="cardBlock">
            <b>Gate: {draft.gate.score}/100 · {draft.gate.riskLevel}</b>
            {draft.gate.blockers.map(b=><p key={b} className="bad inline">✗ {b}</p>)}
            {draft.gate.warnings.slice(0,3).map(w=><p key={w} className="muted">⚠ {w}</p>)}
            {draft.gate.approved&&<p className="ok">Gate passed — scaffolds .loops/{draft.def.id}/ on save.</p>}
          </div>}
        </article>}
      </div>
    </Panel>

    {/* 3 ─ DECISIONS (invisible when empty) */}
    {openDecisions.length>0&&<Panel title="Decisions" badge={`${openDecisions.length} open — agents are blocked on you`}>
      {openDecisions.map(d=><DecisionRow key={d.id} d={d} resolve={resolveDecision}/>)}
    </Panel>}

    {/* 4 ─ SHIPPED + ops footer */}
    <Panel title="Shipped" badge={ship?`${ship.counters.commits7d} commits · 7d`:'…'}>
      {ship&&ship.days.flatMap(d=>d.commits).slice(0,7).map((c,i)=>{
        const repo=repos.find(rp=>rp.label.toLowerCase()===c.repo.toLowerCase());
        const link=repo?.github?`${repo.github}/commit/${c.hash}`:null;
        const row=<><span><span className="tag">{c.repo}</span> {c.subject}</span><small>{c.day.slice(5)}</small></>;
        return link?<a key={i} className="history" style={{textDecoration:'none'}} href={link} target="_blank" rel="noreferrer">{row}</a>:<div key={i} className="history">{row}</div>;
      })}
      {ship&&ship.days.every(d=>!d.commits.length)&&<p className="muted">Nothing shipped in 7 days. That is the signal.</p>}
      <div className="chips" style={{marginTop:'0.75rem'}}>
        {opsButtons.map(a=><button key={a.id} className="ghost" disabled={!a.enabled||!!busy} title={a.disabledReason||a.expectedOutput} onClick={()=>runOpsAction(a.id)}>{busy===a.id?'…':a.label}</button>)}
      </div>
      {runs.slice(0,4).map((r,i)=><button className="history" key={i} onClick={()=>setModal({title:r.label,body:<Result r={r}/>})}><span>{r.success?'✓':'✗'} {r.label}</span><small>{new Date(r.finishedAt).toLocaleTimeString()}</small></button>)}
    </Panel>

    {modal&&<div className="overlay" onClick={()=>setModal(null)}><section className="modal" onClick={e=>e.stopPropagation()}><div className="panelHead"><h2>{modal.title}</h2><button className="ghost" onClick={()=>setModal(null)}>close</button></div><div>{modal.body}</div></section></div>}
  </main>;
}

function LoopCard({loop,post,open,onGate}:{loop:CockpitLoop;post:(p:Record<string,unknown>)=>Promise<any>;open:(m:{title:string;body:React.ReactNode})=>void;onGate:()=>void}){
  const d=loop.def; const [note,setNote]=useState(''); const [stopReason,setStopReason]=useState<LoopStopReason>('manual'); const [busy,setBusy]=useState('');
  const active=loop.status==='running'||loop.status==='gated';
  const rr=loop.lastRunReceipt;
  const leashRed=!!(rr?.diffStat&&(rr.diffStat.insertions+rr.diffStat.deletions)>300);
  const hasVerify=(d.verifyActionIds?.length??0)>0;
  return <article className={`repo loopCard ${loop.status}`}>
    <div className="repoTop"><h3>{d.name}{loop.trusted&&<span className="ok" title="≥5 passing machine receipts"> ★</span>}</h3><span className={loop.status==='complete'?'ok':loop.circuitOpen?'bad':loop.status==='stopped'||loop.status==='gated'?'bad':'ok'}>{loop.circuitOpen?'circuit open':loop.status}</span></div>
    <small>{d.goal}</small>
    <dl>
      <dt>agent</dt><dd>{d.agent} · <SafetyBadge level={d.safetyCeiling}/></dd>
      <dt>verify</dt><dd className={hasVerify?'':'bad inline'}>{hasVerify?d.verifyActionIds!.join(', '):'NONE — autonomy locked to suggest'}</dd>
      <dt>nines</dt><dd>{loop.successRate===null?'no receipts yet':`${Math.round((loop.successRate)*100)}% over ${loop.receiptCount}`}</dd>
      <dt>iterations</dt><dd>{loop.iteration}/{d.maxIterations}</dd>
    </dl>
    {rr&&<p className="muted lastEvent">last receipt: {rr.outcome==='pass'?'✓':'✗'} {rr.commitRange?`${rr.commitRange.to}${rr.commitRange.count>1?` (+${rr.commitRange.count} commits!)`:''}`:'no commit'}{rr.diffStat?` · ±${rr.diffStat.insertions+rr.diffStat.deletions} lines`:''}{rr.criteriaTampered?' · TAMPERED':''}{leashRed?' · LEASH: diff too big':''} — {rr.note||'no note'}</p>}
    {!rr&&loop.lastEvent&&<p className="muted lastEvent">last: {loop.lastEvent.type}{loop.lastEvent.summary?` — ${loop.lastEvent.summary}`:''}</p>}
    <div className="chips">
      <button className="ghost" onClick={()=>{const p=buildPlanPrompt(d); navigator.clipboard.writeText(p); open({title:`PLAN prompt · ${d.name}`,body:<CopyBlock text={p}/>});}}>Plan prompt</button>
      <button className="primary" style={{width:'auto'}} onClick={()=>{const p=buildLoopPrompt(d); navigator.clipboard.writeText(p); open({title:`BUILD prompt · ${d.name}`,body:<CopyBlock text={p}/>});}}>Build prompt</button>
      {hasVerify&&<button className="ghost" disabled={busy==='verify'} onClick={async()=>{setBusy('verify'); const r=await post({loopId:d.id,type:'verify'}); setBusy(''); open({title:`Verify · ${d.name}`,body:r.results?r.results.map((res:Run,i:number)=><Result key={i} r={res}/>):<p className="bad inline">{r.error}</p>});}}>{busy==='verify'?'…':'Run verify'}</button>}
      {hasVerify&&<button className="ghost" disabled={busy==='receipt'} onClick={async()=>{setBusy('receipt'); const r=await post({loopId:d.id,type:'receipt',note}); setBusy(''); setNote(''); if(r.receipt) open({title:`Receipt · ${d.name} · ${r.receipt.outcome}`,body:<CopyBlock text={JSON.stringify(r.receipt,null,2)}/>});}}>{busy==='receipt'?'…':'Log receipt'}</button>}
      {!active&&<button className="ghost" onClick={()=>post({loopId:d.id,type:'start'})}>Start</button>}
      {active&&<>
        <button className="ghost" onClick={async()=>{const r=await post({loopId:d.id,type:'complete',summary:note}); if(r.error) open({title:'Completion refused',body:<p className="bad inline">{r.error}</p>}); setNote('');}}>Complete</button>
        <button className="ghost" onClick={()=>{post({loopId:d.id,type:'stop',reason:stopReason,summary:note}); setNote('');}}>Stop</button>
        <select className="input slim" value={stopReason} onChange={e=>setStopReason(e.target.value as LoopStopReason)}>{(['manual','done','no-progress','budget'] as LoopStopReason[]).map(r=><option key={r} value={r}>{r}</option>)}</select>
        <button className="ghost" onClick={async()=>{await post({loopId:d.id,type:'gate',gateQuestion:note||`${d.name} needs a human decision.`,gateContext:d.humanGates.join('; ')}); setNote(''); onGate();}}>Gate</button>
      </>}
      <button className="ghost" onClick={async()=>{const r=await fetch(`/api/mazos/loop-receipts?loopId=${encodeURIComponent(d.id)}&limit=12`).then(r=>r.json()); open({title:`Receipts · ${d.name}`,body:<CopyBlock text={JSON.stringify(r,null,2)}/>});}}>History</button>
    </div>
    {active&&<input className="input slim" placeholder="one-line note: which plan item this pass" value={note} onChange={e=>setNote(e.target.value)}/>}
  </article>;
}

function DecisionRow({d,resolve}:{d:DecisionItem;resolve:(id:string,status:string,resolution:string)=>void}){
  const [answer,setAnswer]=useState('');
  return <article className="decision">
    <div className="repoTop"><b>{d.question}</b><span className="tag">{d.source}</span></div>
    {d.context&&<small>{d.context}</small>}
    <div className="chips">
      <input className="input slim" placeholder="answer / condition (optional)" value={answer} onChange={e=>setAnswer(e.target.value)}/>
      <button className="ghost" onClick={()=>resolve(d.id,'approved',answer)}>Approve</button>
      <button className="ghost" onClick={()=>resolve(d.id,'denied',answer)}>Deny</button>
      <button className="ghost" disabled={!answer.trim()} onClick={()=>resolve(d.id,'answered',answer)}>Answer</button>
    </div>
  </article>;
}
