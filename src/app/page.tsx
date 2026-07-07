'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { buildHandoff } from '@/lib/mazos/handoff';
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
type ToolRec = { id:string; name:string; kind:string; localPath:string; useWhen:string; safety:SafetyLevel; readFirst:string; matched:string[]; score:number };
type ShipLogData = { generatedAt:string; days:{day:string;commits:{repo:string;day:string;hash:string;subject:string}[]}[]; counters:{commitsToday:number;commits7d:number;reposActive:number;runsOk:number;runsFail:number}; markdown:string };
type SpineRow = { product:string; productId:string; objective:string; nextAction:string; actionSource:string; commercialReason:string; evidence:string[]; evidencePaths:string[]; blocker:string; blocked:boolean; safety:SafetyLevel; owner:string; doneCriteria:string[]; moneyLabel:'high'|'medium'|'low'; score:number; repoPath:string|null; branch:string|null; github:string|null; dirty:number; commits7d:number; staleFindings:{severity:string;title:string}[]; openDecisions:{id:string;question:string}[]; handoffPrompt:string };
type SpineData = { generatedAt:string; verdict:{product:string;action:string;why:string;owner:string;safety:SafetyLevel}; rows:SpineRow[]; savedTo:string; markdown:string };
type FeedItemType = 'decision'|'shipping-spine'|'run'|'stale-work'|'ship-log'|'intake'|'openwiki'|'system';
type FeedLane = 'needs-decision'|'blocked'|'failed-checks'|'stale-work'|'ready-to-ship'|'knowledge-gaps'|'system-pressure'|'watch'|'done';
type FeedUserState = 'unread'|'seen'|'saved'|'snoozed'|'done'|'cleared';
type ScoreBreakdown = { urgency:number; revenue:number; blocker:number; evidence:number; risk:number; recency:number; shippingSpineFit:number; systemPressure:number; total:number };
type FeedItem = { id:string; createdAt:string; updatedAt?:string; type:FeedItemType; lane:FeedLane; source:string; product?:string; title:string; summary:string; whyItMatters:string; nextAction:string; evidence:string[]; evidencePaths:string[]; evidenceQuality:'strong'|'partial'|'weak'|'missing'; safety:SafetyLevel; score:number; scoreBreakdown:ScoreBreakdown; requiresAttention:boolean; status:'new'|'active'|'resolved'|'muted'; userState:FeedUserState; href?:string; copyPrompt?:string };
type FeedData = { generatedAt:string; mode:string; verdict:{changedWhatShipsNext:boolean; headline:string; nextAction:string; topItemId:string|null}; filters:{products:string[]; types:FeedItemType[]; attentionCount:number; unreadCount:number}; items:FeedItem[]; degraded:boolean; warnings:string[] };
type FlightRecord = { itemId:string; product?:string; events:{at:string;kind:string;label:string;ok?:boolean;detail?:string}[]; sources:string[]; notVerified:string[] };
type SystemInternals = { generatedAt:string; local:boolean; host:string; uptimeHours:number; cpu:{model:string;cores:number;usagePct:number|null}; ram:{totalMb:number;usedMb:number;usedPct:number}; disk:{drive:string;totalGb:number;freeGb:number}|null; gpu:{name:string;vramTotalMb:number;vramUsedMb:number;utilizationPct:number;temperatureC:number}|null; pressure:{ram:boolean;vram:boolean} };
type SourceReceipt = { title:string; kind:string; pathOrUrl:string; freshness:string; confidence:'high'|'medium'|'low'; readFirst:boolean; sensitive:boolean; product?:string };
type ContextMap = { generatedAt:string; project:string; repoPath:string|null; blocker:string; nextBestAction:string; receipts:SourceReceipt[]; missingKnowledge:string[]; copyPrompt:string };
type ServerBrief = { generatedAt:string; headline:string; shipNext:string; needsYou:string[]; avoidToday:string; safestNextPrompt:string; evidence:string[]; markdown:string; degraded:boolean; warnings:string[]; aiInbox?:{newCount:number;topSkillCandidate:string|null;topLoopCandidate:string|null;recommendedAction:string}; trust?:{untrustedCount:number;topRiskySkill:string|null;topLowValueItem:string|null;cleanupAction:string} };
type AgentRuntime = { id:string; name:string; kind:string; status:string; pathHint:string; safetyCeiling:SafetyLevel; allowedModes:string[]; preferredTasks:string[]; forbidden:string[]; validationCommands:string[]; bridgeAware:boolean; lastTraceHint:string };
type AgentRuntimeRegistry = { generatedAt:string; safety:{safeMode:boolean; allowShell:boolean; allowPush:boolean; allowDestructive:boolean}; recommendedRuntimeId:string; recommendationReason:string; runtimes:AgentRuntime[] };
type AiSourceItem = { id:string; rawInput:string; url:string; sourcePlatform:string; sourceType:string; title:string; summary:string; notes:string; tags:string[]; status:string; usefulnessScore:number; trustScore:number; suggestedAction:string; createdAt:string; updatedAt:string };
type AiInboxSummary = { total:number; countsByStatus:Record<string,number>; countsByPlatform:Record<string,number>; latest:AiSourceItem[]; topByUsefulness:AiSourceItem[]; topSkillCandidate:AiSourceItem|null; topLoopCandidate:AiSourceItem|null; recommendedNextAction:string };
type SkillSpec = { id:string; name:string; sourceItemIds:string[]; sourceUrls:string[]; category:string; whatItDoes:string; whenToUse:string; inputsNeeded:string[]; expectedOutput:string; requiredTools:string[]; safetyRisks:string[]; setupNotes:string; testPlan:string[]; rejectionReasons:string[]; status:string; usefulnessScore:number; trustScore:number; riskLevel:string; createdAt:string; updatedAt:string };
type SkillSummary = { total:number; countsByStatus:Record<string,number>; topCandidates:SkillSpec[]; rejectedCount:number; archivedCount:number };
type Pack = { id:string; name:string; type:string; audience:string; description:string; includedLoopIds:string[]; includedSkillIds:string[]; sourceItemIds:string[]; useCases:string[]; setupSteps:string[]; safetyNotes:string[]; proofReceipts:string[]; status:string; usefulnessScore:number; trustScore:number; installComplexity:string; createdAt:string; updatedAt:string };
type PackSummary = { total:number; approved:Pack[]; drafts:Pack[]; testReady:Pack[]; topByUsefulness:Pack[]; countsByType:Record<string,number>; countsByAudience:Record<string,number> };
type ReaperRecommendation = { id:string; target:string; targetId:string; title:string; action:string; severity:'low'|'medium'|'high'; reason:string; productImpact:string; safeToApply:boolean };
type ClutterReaperReport = { generatedAt:string; productKernel:string[]; score:number; verdict:string; recommendations:ReaperRecommendation[]; quickWins:ReaperRecommendation[]; blockedActions:ReaperRecommendation[]; nextAction:string };
type AiEngineData = { inbox:{items:AiSourceItem[];summary:AiInboxSummary}; skills:{skills:SkillSpec[];summary:SkillSummary}; packs:{packs:Pack[];summary:PackSummary}; reaper:ClutterReaperReport };
type LoopPatternId = 'auto'|'research-intelligence'|'daily-triage'|'pr-babysitter'|'build-doctor'|'intake-drainer'|'ship-log'|'github-pulse'|'useless-feature-reaper'|'revenue-radar'|'founder-inbox';
type LoopUsefulnessAudit = { score:number; decision:'keep'|'revise'|'merge'|'remove'; label:string; strengths:string[]; gaps:string[]; dimensions:Record<string,number> };
type LoopFactoryDraft = { pattern:Exclude<LoopPatternId,'auto'>; def:LoopState['def']; readinessScore:number; readiness:'ready'|'needs-review'|'unsafe'; warnings:string[]; evidenceRequired:string[]; audit:LoopUsefulnessAudit };
type LoopReceiptSummary = { count:number; latestStatus:string|null; latestAt:string|null; latestEvidence:string|null };
type AuditedLoopState = LoopState & { audit?:LoopUsefulnessAudit; receipts?:LoopReceiptSummary };
type Tab = 'NOW'|'INBOX'|'WORK'|'INTAKE'|'SYSTEM';
type BridgeState = { checked:boolean; available:boolean; url:string; detail:string };

const cats = ['Execute','Repos','Recall','JobFilter','Obsidian','System'];
const TABS: Tab[] = ['NOW','INBOX','WORK','INTAKE','SYSTEM'];
const LEGACY_TABS: Record<string,Tab> = { FEED:'INBOX', LOOPS:'WORK', PROJECTS:'WORK' };
function normalizeTab(saved:string|null):Tab{ if(!saved) return 'NOW'; if(TABS.includes(saved as Tab)) return saved as Tab; return LEGACY_TABS[saved] ?? 'NOW'; }
const LOCAL_BRIDGE = 'http://127.0.0.1:3047';
function SafetyBadge({level}:{level:SafetyLevel}){ const s=SAFETY_LEVELS[level]; return <span className={`safety s${level}`} title={s.meaning}>{level} {s.label}</span> }
function shouldUseLocalBridge() {
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'https:' && window.location.hostname.includes('vercel.app');
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
async function mazosFetch(path:string, init?:RequestInit) {
  if (shouldUseLocalBridge()) {
    try {
      const res = await fetch(`${LOCAL_BRIDGE}${path}`, { ...init, cache:'no-store', signal:AbortSignal.timeout(30_000) });
      if (res.ok) return res;
    } catch {
      // Fall back to hosted API so the page remains usable when the local bridge is off.
    }
  }
  return fetch(path, init);
}

export default function Page() {
  const [data,setData]=useState<Data|null>(null), [busy,setBusy]=useState(''), [modal,setModal]=useState<{title:string;body:React.ReactNode}|null>(null);
  const [ingest,setIngest]=useState({ urls:'', sourceType:'auto', target:'Recall', tags:'', notes:'' }); const [files,setFiles]=useState<FileList|null>(null); const [clock,setClock]=useState('');
  const [statusDeck,setStatusDeck]=useState<ProjectStatus[]>([]);
  const [routerTask,setRouterTask]=useState(''), [routerRecs,setRouterRecs]=useState<ToolRec[]>([]), [routerBusy,setRouterBusy]=useState(false);
  const [tab,setTab]=useState<Tab>('NOW');
  const [loops,setLoops]=useState<AuditedLoopState[]>([]); const [decisions,setDecisions]=useState<DecisionItem[]>([]);
  const [loopFactory,setLoopFactory]=useState({ goal:'Research JobFilter competitors weekly and turn what works into product moves.', project:'JobFilter', pattern:'research-intelligence' as LoopPatternId, sources:'' });
  const [loopDraft,setLoopDraft]=useState<LoopFactoryDraft|null>(null);
  const [ship,setShip]=useState<ShipLogData|null>(null);
  const [spine,setSpine]=useState<SpineData|null>(null);
  const [feed,setFeed]=useState<FeedData|null>(null);
  const [brief,setBrief]=useState<ServerBrief|null>(null), [contextMap,setContextMap]=useState<ContextMap|null>(null), [runtimeRegistry,setRuntimeRegistry]=useState<AgentRuntimeRegistry|null>(null);
  const [aiEngine,setAiEngine]=useState<AiEngineData|null>(null);
  const [aiPaste,setAiPaste]=useState('');
  const [paletteOpen,setPaletteOpen]=useState(false);
  const [bridge,setBridge]=useState<BridgeState>({checked:false,available:false,url:LOCAL_BRIDGE,detail:'Checking local bridge...'});
  const [sys,setSys]=useState<SystemInternals|null>(null);
  async function loadSys(){ try{ const r=await mazosFetch('/api/mazos/system').then(r=>r.json()); setSys(r&&r.local?r:null); }catch{ setSys(null); } }
  async function refresh(){ const [main,repos,health,runs]=await Promise.all([mazosFetch('/api/mazos').then(r=>r.json()),mazosFetch('/api/mazos/repos').then(r=>r.json()),mazosFetch('/api/mazos/health').then(r=>r.json()),mazosFetch('/api/mazos/runs?limit=8').then(r=>r.json())]); setData({...main, repos:repos.repos, services:health.services, runs:runs.runs, buttons:main.buttons||[]}); }
  async function loadStatusDeck(){ const names=['JobFilter','Recall','MAZos','Vault']; const statuses=await Promise.all(names.map(name=>mazosFetch(`/api/mazos/project-status?project=${encodeURIComponent(name)}`).then(r=>r.json()))); setStatusDeck(statuses.filter(x=>!x.error)); }
  async function loadLoops(){ const r=await mazosFetch('/api/mazos/loops').then(r=>r.json()); setLoops(r.loops||[]); }
  async function loadDecisions(){ const r=await mazosFetch('/api/mazos/decisions').then(r=>r.json()); setDecisions(r.decisions||[]); }
  async function loadShip(){ const r=await mazosFetch('/api/mazos/shiplog').then(r=>r.json()); setShip(r); }
  async function loadSpine(){ try{ const r=await mazosFetch('/api/mazos/shipping-spine').then(r=>r.json()); if(!r.error) setSpine(r); }catch{ /* spine loads lazily; NOW view shows loading state */ } }
  async function loadFeed(){ const r=await mazosFetch('/api/mazos/feed?limit=30').then(r=>r.json()); setFeed(r); }
  async function loadBrief(){ try{ const r=await mazosFetch('/api/mazos/morning-brief?project=MAZos').then(r=>r.json()); if(!r.error) setBrief(r); }catch{ setBrief(null); } }
  async function loadAiEngine(){ try{ const [inbox,skills,packs,reaper]=await Promise.all([mazosFetch('/api/mazos/ai-source-inbox').then(r=>r.json()),mazosFetch('/api/mazos/skill-factory').then(r=>r.json()),mazosFetch('/api/mazos/loop-store').then(r=>r.json()),mazosFetch('/api/mazos/clutter-reaper').then(r=>r.json())]); setAiEngine({inbox,skills,packs,reaper}); }catch{ setAiEngine(null); } }
  async function loadContextMap(project='MAZos'){ try{ const r=await mazosFetch(`/api/mazos/context-map?project=${encodeURIComponent(project)}`).then(r=>r.json()); if(!r.error) setContextMap(r); }catch{ setContextMap(null); } }
  async function loadRuntimes(task=''){ try{ const qs=task?`?task=${encodeURIComponent(task)}`:''; const r=await mazosFetch(`/api/mazos/agent-runtimes${qs}`).then(r=>r.json()); if(!r.error) setRuntimeRegistry(r); }catch{ setRuntimeRegistry(null); } }
  async function setFeedState(id:string,state:FeedUserState){ setFeed(f=>f?{...f,items:f.items.map(i=>i.id===id?{...i,userState:state}:i)}:f); await mazosFetch('/api/mazos/feed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,state})}).catch(()=>undefined); }
  async function loopEvent(loopId:string, type:string, extra:Record<string,string>={}){ const r=await mazosFetch('/api/mazos/loops',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({loopId,type,...extra})}).then(r=>r.json()); if(r.loops) setLoops(r.loops); if(type==='gate') loadDecisions(); }
  async function draftLoop(){ setBusy('loop-factory-draft'); const r=await mazosFetch('/api/mazos/loop-factory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...loopFactory,action:'draft'})}).then(r=>r.json()); setLoopDraft(r.draft||null); setBusy(''); }
  async function saveLoop(){ setBusy('loop-factory-save'); const r=await mazosFetch('/api/mazos/loop-factory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...loopFactory,action:'save'})}).then(r=>r.json()); setLoopDraft(r.draft||null); setBusy(''); if(r.ok){ await loadLoops(); setModal({title:'Loop template saved',body:<p className="muted">{r.draft?.def?.name || 'Custom loop'} saved to the Loop Engineering Deck.</p>}); } else { setModal({title:'Loop template not saved',body:<div><p className="bad inline">{r.error || 'Save failed.'}</p>{r.draft&&<CopyBlock text={buildLoopPrompt(r.draft.def)}/>}</div>}); } }
  async function submitAiPaste(){ if(!aiPaste.trim())return; setBusy('ai-source-inbox'); const r=await mazosFetch('/api/mazos/ai-source-inbox',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({raw:aiPaste})}).then(r=>r.json()); setBusy(''); if(!r.error){ setAiPaste(''); await loadAiEngine(); await loadBrief(); } setModal({title:r.error?'AI Source Inbox failed':'AI Source Inbox',body:r.error?<p className="bad inline">{r.error}</p>:<div><p className="muted">Added {r.added?.length||0}; skipped duplicates {r.skippedDuplicates||0}.</p><CopyBlock text={JSON.stringify(r.summary,null,2)}/></div>}); }
  async function patchAiSource(id:string, status:string){ await mazosFetch('/api/mazos/ai-source-inbox',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})}); await loadAiEngine(); await loadBrief(); }
  async function makeSkill(item:AiSourceItem){ setBusy(`skill-${item.id}`); const r=await mazosFetch('/api/mazos/skill-factory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sourceItemId:item.id})}).then(r=>r.json()); setBusy(''); await loadAiEngine(); await loadBrief(); setModal({title:r.error?'Skill draft failed':`Skill draft · ${r.skill?.name||item.title}`,body:r.error?<p className="bad inline">{r.error}</p>:<div><CopyBlock text={r.markdown}/><details><summary>Eval checklist</summary><CopyBlock text={r.evalChecklist}/></details></div>}); }
  async function patchSkill(id:string,status:string){ const body=status==='approved'?{id,status,approvalNote:'Approved from MAZos cockpit after human review.',testEvidence:'Manual approval recorded; run checklist before installation.',sourceLinkOrExplanation:'Source is linked in the skill candidate.',riskAccepted:true}:{id,status}; const r=await mazosFetch('/api/mazos/skill-factory',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json()); await loadAiEngine(); if(r.error) setModal({title:'Skill update blocked',body:<CopyBlock text={JSON.stringify(r,null,2)}/>}); }
  async function patchPack(id:string,status:string){ await mazosFetch('/api/mazos/loop-store',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})}); await loadAiEngine(); }
  async function copyPackReadme(id:string){ const r=await mazosFetch(`/api/mazos/loop-store?readme=${encodeURIComponent(id)}`).then(r=>r.json()); setModal({title:`Pack README · ${r.pack?.name||id}`,body:<CopyBlock text={r.readme||JSON.stringify(r,null,2)}/>}); }
  async function applyReaper(id:string){ const r=await mazosFetch('/api/mazos/clutter-reaper',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})}).then(r=>r.json()); await loadAiEngine(); await loadBrief(); setModal({title:r.ok?'Cleanup applied':'Cleanup blocked',body:<CopyBlock text={JSON.stringify(r,null,2)}/>}); }
  function addSourceToLoop(item:AiSourceItem){ const source=[item.url,item.summary,item.notes].filter(Boolean).join('\n'); const pattern=suggestUiLoopPattern(item); setLoopFactory({goal:`Turn this AI source into a reusable MAZos loop: ${item.title}`,project:'MAZos',pattern,sources:source}); patchAiSource(item.id,'loop_candidate'); setTab('WORK'); }
  async function resolveDecision(id:string, status:string, resolution:string){ const r=await mazosFetch('/api/mazos/decisions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'resolve',id,status,resolution})}).then(r=>r.json()); if(r.decisions){ setDecisions(r.decisions); const item=(r.decisions as DecisionItem[]).find(d=>d.id===id); if(item) setModal({title:'Resolution prompt · paste to the waiting agent',body:<CopyBlock text={buildResolutionPrompt(item)}/>}); } }
  async function addDecision(question:string, context:string){ const r=await mazosFetch('/api/mazos/decisions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'open',source:'manual',question,context})}).then(r=>r.json()); if(r.decisions) setDecisions(r.decisions); }
  async function routeTool(){ if(!routerTask.trim())return; setRouterBusy(true); const [r]=await Promise.all([mazosFetch(`/api/mazos/tool-router?task=${encodeURIComponent(routerTask)}`).then(r=>r.json()), loadRuntimes(routerTask)]); setRouterRecs(r.recommendations||[]); setRouterBusy(false); }
  useEffect(()=>{ document.documentElement.dataset.theme='dark'; setTab(normalizeTab(localStorage.getItem('mazos-tab')));
    // Research → Loop Factory handoff: consume a prefill left by /research.
    try{ const raw=localStorage.getItem('mazos-loopfactory-draft'); if(raw){ localStorage.removeItem('mazos-loopfactory-draft'); const d=JSON.parse(raw); if(d&&typeof d.goal==='string'&&d.goal.trim()){ const pattern=LOOP_PATTERN_OPTIONS.some(([id])=>id===d.pattern)?d.pattern as LoopPatternId:'research-intelligence'; setLoopFactory({goal:d.goal,project:String(d.project||'MAZos'),pattern,sources:String(d.sources||'')}); setTab('WORK'); } } }catch{ localStorage.removeItem('mazos-loopfactory-draft'); } bridgeHealth().then(setBridge); refresh(); loadStatusDeck(); loadLoops(); loadDecisions(); loadShip(); loadSpine(); loadFeed(); loadBrief(); loadAiEngine(); loadContextMap(); loadRuntimes(); loadSys(); const t=setInterval(()=>setClock(new Date().toLocaleTimeString()),1000); const ts=setInterval(loadSys,30_000); return()=>{clearInterval(t);clearInterval(ts);}; },[]);
  useEffect(()=>{ localStorage.setItem('mazos-tab',tab); },[tab]);
  useEffect(()=>{ const h=(e:KeyboardEvent)=>{ if((e.ctrlKey&&e.key.toLowerCase()==='k')||(e.key==='/'&&!(e.target as HTMLElement).closest('input,textarea,select'))){ e.preventDefault(); setPaletteOpen(o=>!o); } if(e.key==='Escape') setPaletteOpen(false); }; window.addEventListener('keydown',h); return()=>window.removeEventListener('keydown',h); },[]);
  const summary=useMemo(()=> data ? { existing:data.repos.filter(r=>r.exists).length, dirty:data.repos.filter(r=>r.dirty).length, optionalDown:data.services.filter(s=>!s.online&&s.signal==='not-running').length, critical:data.services.filter(s=>!s.online&&s.signal!=='not-running').length } : null,[data]);
  const openDecisions=decisions.filter(d=>d.status==='open');
  async function runAction(id:string){ setBusy(id); const r=await mazosFetch('/api/mazos/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})}).then(r=>r.json()); setBusy(''); setModal({title:r.label, body:<Result r={r}/>}); refresh(); }
  async function loadContextPack(project:string){ setBusy('context-pack'); const r=await mazosFetch(`/api/mazos/context-pack?project=${encodeURIComponent(project)}`).then(r=>r.json()); setBusy(''); if(r.error){ setModal({title:'Context Pack',body:r.error}); return; } setModal({title:`Context Pack · ${r.project} · ${r.lines} lines`,body:<div><CopyBlock text={r.markdown}/><p className="muted">Saved: {r.savedTo}</p></div>}); }
  async function doIngest(){ setBusy('ingest'); const fd=new FormData(); Object.entries(ingest).forEach(([k,v])=>fd.append(k,v)); Array.from(files||[]).forEach(f=>fd.append('files',f)); const r=await mazosFetch('/api/mazos/ingest',{method:'POST',body:fd}).then(r=>r.json()); const now=new Date().toISOString(); const rr={success:!!r.success,actionId:'ingest_urls',label:'Ingest Intake',cwd:'api',commandPreview:'POST /api/mazos/ingest',stdout:JSON.stringify(r,null,2),stderr:r.error||'',exitCode:r.success?0:1,startedAt:now,finishedAt:now,durationMs:0,nextSuggestedAction:r.queued?'Open Intake Queue and process queued sources.':'Review routed sources in Recall.'}; setBusy(''); setModal({title:'Intake Result',body:<Result r={rr}/>}); refresh(); }
  if(!data||!summary) return <main className="shell"><div className="boot">MAZ_OS :: BOOTING COCKPIT…</div></main>;
  const byCat=Object.fromEntries(cats.map(c=>[c,data.buttons.filter(b=>b.category===c)]));
  return <main className="shell"><div className="gridGlow" />
    <header className="topbar"><div><h1>MAZOS COCKPIT</h1><p className="mission">{data.mission}</p></div><div className="topRight"><div className="topLinks"><a href="/research">RESEARCH</a><a href="/sessions">TASK GATE</a><a href="/openwiki">OPENWIKI</a></div><div className="topStats"><b>{clock}</b><span>{summary.existing}/{data.repos.length} repos</span><span>{summary.dirty} dirty</span><span>{summary.optionalDown} optional off</span><span>{summary.critical} critical</span></div></div></header>
    <SystemStrip sys={sys}/>
    <BridgeBanner bridge={bridge} refreshBridge={()=>bridgeHealth().then(setBridge)}/>
    <nav className="tabs">{TABS.map(t=><button key={t} className={`tabBtn ${tab===t?'active':''}`} onClick={()=>setTab(t)}>{t}{t==='WORK'&&openDecisions.length>0&&<span className="tabBadge">{openDecisions.length}</span>}{t==='INBOX'&&(feed?.filters.unreadCount??0)>0&&<span className="tabBadge">{feed!.filters.unreadCount}</span>}</button>)}<button className="tabBtn paletteHint" onClick={()=>setPaletteOpen(true)}>⌘ Ctrl+K</button></nav>

    {tab==='NOW'&&<>
      <SpinePanel spine={spine} brief={brief} ship={ship} run={runAction} open={setModal} reload={loadSpine}/>
      <StatsStrip spine={spine} ship={ship} repos={data.repos}/>
      <LoopStrip/>
      <RecentShippedStrip ship={ship} repos={data.repos}/>
    </>}

    {tab==='INBOX'&&<>
      <FeedPanel feed={feed} reload={loadFeed} open={setModal} goNow={()=>setTab('NOW')} setState={setFeedState}/>
    </>}

    {tab==='WORK'&&<>
      <Panel title="Project Command Cards" badge="commit · PR · dirty · blocker · next · evidence">
        <div className="repos">{statusDeck.map(s=><ProjectCard key={s.query} status={s} open={setModal} pack={loadContextPack} busy={busy}/>)}</div>
      </Panel>
      <LoopFactoryPanel form={loopFactory} setForm={setLoopFactory} draft={loopDraft} busy={busy} draftLoop={draftLoop} saveLoop={saveLoop} open={setModal}/>
      <Panel title="Loop Engineering Deck" badge={deckBadge(loops)}><div className="loopDeck">{loops.map(l=><LoopCard key={l.def.id} loop={l} event={loopEvent} open={setModal}/>)}</div></Panel>
      <DecisionInbox decisions={decisions} resolve={resolveDecision} add={addDecision} open={setModal}/>
      <AgentPrepPanel statuses={statusDeck} contextMap={contextMap} reloadContext={()=>loadContextMap('MAZos')} routerTask={routerTask} setRouterTask={setRouterTask} routerRecs={routerRecs} routerBusy={routerBusy} route={routeTool} registry={runtimeRegistry} reloadRuntimes={()=>loadRuntimes(routerTask)} open={setModal}/>
    </>}

    {tab==='INTAKE'&&<section className="split intakeSplit">
      <Panel title="Source Intake" badge="writes queue"><textarea className="input big" rows={5} placeholder="Paste YouTube / Instagram / X / web URLs — one per line" value={ingest.urls} onChange={e=>setIngest({...ingest,urls:e.target.value})}/><div className="cols"><select className="input" value={ingest.sourceType} onChange={e=>setIngest({...ingest,sourceType:e.target.value})}>{['auto','youtube','instagram','x','pdf','webpage'].map(x=><option key={x}>{x}</option>)}</select><select className="input" value={ingest.target} onChange={e=>setIngest({...ingest,target:e.target.value})}>{['Recall','Obsidian','JobFilter research'].map(x=><option key={x}>{x}</option>)}</select></div><label className="drop"><input type="file" multiple accept=".pdf,.txt,.md" onChange={e=>setFiles(e.target.files)}/><span>{files?.length?`${files.length} file(s) staged`:'Drop PDFs / notes here'}</span></label><input className="input" placeholder="tags e.g. recall market youtube" value={ingest.tags} onChange={e=>setIngest({...ingest,tags:e.target.value})}/><textarea className="input" rows={2} placeholder="why this matters / extraction goal" value={ingest.notes} onChange={e=>setIngest({...ingest,notes:e.target.value})}/><button className="primary hot" disabled={(!ingest.urls&&!files?.length)||!!busy} onClick={doIngest}>{busy==='ingest'?'ROUTING…':'ROUTE / QUEUE SOURCES'}</button></Panel>
      <AIIntelligencePanel data={aiEngine} paste={aiPaste} setPaste={setAiPaste} busy={busy} submit={submitAiPaste} refresh={loadAiEngine} makeSkill={makeSkill} addToLoop={addSourceToLoop} patchSource={patchAiSource} patchSkill={patchSkill} patchPack={patchPack} copyPackReadme={copyPackReadme} applyReaper={applyReaper} open={setModal}/>
    </section>}

    {tab==='SYSTEM'&&<section className="split">
      <div><Panel title="Ops Radar" badge="local + cloud"><div className="radar">{data.services.map(s=><button key={s.id} onClick={()=>setModal({title:s.label,body:<ServiceDetail s={s}/>})} className={`orb ${s.online?'on':'off'} ${s.signal==='not-running'?'idle':''}`}><b>{s.label}</b><span>{s.online?`${s.status} · ${s.latencyMs}ms`:s.signal}</span><small>{s.url||s.path}</small></button>)}</div></Panel>
      <Panel title="Action Matrix" badge="click → summary modal">{cats.map(c=><div key={c} className="actionBlock"><h3>{c}</h3><div className="chips">{(byCat[c] as Action[]).map(a=><ActionLine key={a.id} a={a} run={runAction} busy={busy}/>)}</div></div>)}</Panel></div>
      <div><Panel title="Run History" badge="last 8">{data.runs?.slice(0,8).map((r,i)=><button className="history" key={i} onClick={()=>setModal({title:r.label,body:<Result r={r}/>})}><span>{r.success?'✓':'✗'} {r.label}</span><small>{new Date(r.finishedAt).toLocaleTimeString()}</small></button>)}{(!data.runs||data.runs.length===0)&&<p className="muted">No runs yet.</p>}</Panel></div>
    </section>}

    {paletteOpen&&<CommandPalette actions={data.buttons} loops={loops} projects={statusDeck} close={()=>setPaletteOpen(false)} exec={{runAction,setTab,openLoopPrompt:(l:LoopState)=>setModal({title:`Loop prompt · ${l.def.name}`,body:<CopyBlock text={buildLoopPrompt(l.def)}/>})}}/>}
    {modal&&<div className="overlay" onClick={()=>setModal(null)}><section className="modal" onClick={e=>e.stopPropagation()}><div className="panelHead"><h2>{modal.title}</h2><button className="ghost" onClick={()=>setModal(null)}>close</button></div><div>{modal.body}</div></section></div>}
  </main>;
}

function suggestUiLoopPattern(item:AiSourceItem):LoopPatternId{
  const text=`${item.title} ${item.summary} ${item.rawInput}`.toLowerCase();
  if(/pricing|saas|funnel|revenue|conversion/.test(text)) return 'revenue-radar';
  if(/build|lint|\bci\b|dev tool|tooling|compile/.test(text)) return 'build-doctor';
  if(item.sourceType==='competitor'||/competitor|market research/.test(text)) return 'research-intelligence';
  if(item.sourcePlatform==='github'&&item.sourceType==='repo') return 'github-pulse';
  if(/weak|low.value|useless|bloat/.test(text)) return 'useless-feature-reaper';
  if(item.sourceType==='workflow'||/repeat|every (day|week)|recurring/.test(text)) return 'intake-drainer';
  return 'founder-inbox';
}

function skillMarkdown(s:SkillSpec):string{
  return [`# Skill Spec`, ``, `## Name`, s.name, ``, `## Source`, ...(s.sourceUrls.length?s.sourceUrls.map(u=>`- ${u}`):['- Local note']), ``, `## Category`, s.category, ``, `## What it does`, s.whatItDoes, ``, `## When MAZos should use it`, s.whenToUse, ``, `## Inputs needed`, ...s.inputsNeeded.map(i=>`- ${i}`), ``, `## Expected output`, s.expectedOutput, ``, `## Required tools`, ...s.requiredTools.map(t=>`- ${t}`), ``, `## Safety / limits`, ...s.safetyRisks.map(r=>`- ${r}`), ``, `## Test plan`, ...s.testPlan.map(t=>`- ${t}`), ``, `## Keep / reject decision`, `- usefulness ${s.usefulnessScore}/100 · trust ${s.trustScore}/100 · risk ${s.riskLevel} · status ${s.status}`].join('\n');
}

function AIIntelligencePanel({data,paste,setPaste,busy,submit,refresh,makeSkill,addToLoop,patchSource,patchSkill,patchPack,copyPackReadme,applyReaper,open}:{data:AiEngineData|null;paste:string;setPaste:(v:string)=>void;busy:string;submit:()=>void;refresh:()=>void;makeSkill:(item:AiSourceItem)=>void;addToLoop:(item:AiSourceItem)=>void;patchSource:(id:string,status:string)=>void;patchSkill:(id:string,status:string)=>void;patchPack:(id:string,status:string)=>void;copyPackReadme:(id:string)=>void;applyReaper:(id:string)=>void;open:(m:{title:string;body:React.ReactNode})=>void}){
  const [view,setView]=useState<'Sources'|'Skills'|'Packs'|'Reaper'>('Sources');
  const inbox=data?.inbox.summary; const skills=data?.skills.summary; const packs=data?.packs.summary; const reaper=data?.reaper;
  const latest=data?.inbox.items.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,6)||[];
  const topSkills=data?.skills.skills.filter(s=>s.status!=='archived'&&s.status!=='rejected').sort((a,b)=>b.usefulnessScore-a.usefulnessScore).slice(0,4)||[];
  const topPacks=data?.packs.packs.filter(p=>p.status!=='archived').slice(0,5)||[];
  return <Panel title="AI Intelligence Engine" badge={`${inbox?.total||0} sources · ${skills?.total||0} skills · ${packs?.total||0} packs`}>
    <p className="muted">Paste messy AI inputs. MAZos classifies, scores, and forces an action: research, skill, loop, competitor, product idea, archive, or ignore.</p>
    <p className="muted">For Instagram AI Feed: paste share links, captions, or rough notes from saved posts. MAZos will classify them without needing Instagram access.</p>
    <textarea className="input big" rows={5} value={paste} onChange={e=>setPaste(e.target.value)} placeholder="Paste GitHub repos, MCPs, prompts, AI tools, workflow notes, AI Feed captions, docs, YouTube links, or random notes."/>
    <div className="chips">
      <button className="primary hot" disabled={!paste.trim()||busy==='ai-source-inbox'} onClick={submit}>{busy==='ai-source-inbox'?'CLASSIFYING…':'Classify Sources'}</button>
      <button className="ghost" onClick={refresh}>Refresh</button>
    </div>
    <div className="aiStats">
      <span><b>{inbox?.countsByStatus?.new||0}</b> new</span>
      <span><b>{inbox?.topSkillCandidate?1:0}</b> skill pick</span>
      <span><b>{inbox?.topLoopCandidate?1:0}</b> loop pick</span>
      <span><b>{reaper?.quickWins.length||0}</b> cleanups</span>
    </div>
    <p className="aiNext">{view==='Reaper' ? reaper?.nextAction || 'Run the cleanup loop to reduce MAZos.' : inbox?.recommendedNextAction||'Paste sources to start the intelligence engine.'}</p>
    <div className="chips aiSwitch">{(['Sources','Skills','Packs','Reaper'] as const).map(v=><button key={v} className={`ghost ${view===v?'active':''}`} onClick={()=>setView(v)}>{v}</button>)}</div>
    {view==='Sources'&&<div className="aiList">{latest.length?latest.map(item=><article key={item.id} className="aiItem">
      <div className="repoTop"><h3>{item.title}</h3><span className="rowTags"><span className="tag">{item.sourcePlatform}</span><span className="tag">{item.sourceType}</span></span></div>
      <p>{item.summary}</p>
      <small className="dim">use {item.usefulnessScore} · trust {item.trustScore} · {item.suggestedAction} · {item.status}</small>
      <div className="chips">
        <button className="ghost" disabled={busy===`skill-${item.id}`} onClick={()=>makeSkill(item)}>Make Skill</button>
        <button className="ghost" onClick={()=>addToLoop(item)}>Add to Loop</button>
        <button className="ghost" onClick={()=>patchSource(item.id,'research')}>Research</button>
        <button className="ghost" onClick={()=>patchSource(item.id,'archived')}>Archive</button>
        <button className="ghost" onClick={()=>patchSource(item.id,'ignored')}>Ignore</button>
      </div>
    </article>):<p className="muted">No AI sources yet.</p>}</div>}
    {view==='Skills'&&<div className="aiList">{topSkills.length?topSkills.map(skill=><article key={skill.id} className="aiItem">
      <div className="repoTop"><h3>{skill.name}</h3><span className="rowTags"><span className="tag">{skill.category}</span><span className={skill.riskLevel==='high'?'bad':'tag'}>{skill.riskLevel}</span></span></div>
      <p>{skill.whatItDoes}</p>
      <small className="dim">use {skill.usefulnessScore} · trust {skill.trustScore} · {skill.status}</small>
      <div className="chips">
        <button className="ghost" onClick={()=>open({title:`Skill spec · ${skill.name}`,body:<CopyBlock text={skillMarkdown(skill)}/>})}>Copy Skill Spec</button>
        <button className="ghost" onClick={()=>patchSkill(skill.id,'test_ready')}>Test Ready</button>
        <button className="ghost" onClick={()=>patchSkill(skill.id,'approved')}>Approve</button>
        <button className="ghost" onClick={()=>patchSkill(skill.id,'rejected')}>Reject</button>
        <button className="ghost" onClick={()=>patchSkill(skill.id,'archived')}>Archive</button>
      </div>
    </article>):<p className="muted">No skill drafts yet. Use Make Skill from a source.</p>}</div>}
    {view==='Packs'&&<div className="aiList">{topPacks.length?topPacks.map(pack=><article key={pack.id} className="aiItem">
      <div className="repoTop"><h3>{pack.name}</h3><span className="rowTags"><span className="tag">{pack.type}</span><span className="tag">{pack.status}</span></span></div>
      <p>{pack.description}</p>
      <small className="dim">use {pack.usefulnessScore} · trust {pack.trustScore} · {pack.audience}</small>
      <div className="chips">
        <button className="ghost" onClick={()=>copyPackReadme(pack.id)}>Copy Pack README</button>
        <button className="ghost" onClick={()=>patchPack(pack.id,'test_ready')}>Test Ready</button>
        <button className="ghost" onClick={()=>patchPack(pack.id,'archived')}>Archive</button>
      </div>
    </article>):<p className="muted">Starter packs will seed after the first refresh.</p>}</div>}
    {view==='Reaper'&&<div className="aiList">
      {reaper?<>
        <div className="reaperScore"><b>{reaper.score}</b><span>{reaper.verdict}</span></div>
        <details open><summary>Product kernel</summary><ul className="summaryList">{reaper.productKernel.map(item=><li key={item}>{item}</li>)}</ul></details>
        <h3>Safe quick wins</h3>
        {reaper.quickWins.length?reaper.quickWins.map(item=><ReaperCard key={item.id} item={item} applyReaper={applyReaper}/>):<p className="muted">No safe cleanup to apply.</p>}
        <h3>Advisory cleanup</h3>
        {reaper.blockedActions.length?reaper.blockedActions.map(item=><ReaperCard key={item.id} item={item} applyReaper={applyReaper}/>):<p className="muted">No advisory cleanup waiting.</p>}
      </>:<p className="muted">Loading cleanup loop...</p>}
    </div>}
  </Panel>;
}

function ReaperCard({item,applyReaper}:{item:ReaperRecommendation;applyReaper:(id:string)=>void}){
  return <article className="aiItem reaperItem">
    <div className="repoTop"><h3>{item.title}</h3><span className="rowTags"><span className={`tag reaperSeverity ${item.severity}`}>{item.severity}</span><span className="tag">{item.action}</span></span></div>
    <p>{item.reason}</p>
    <small className="dim">{item.target} · {item.productImpact}</small>
    <div className="chips">{item.safeToApply?<button className="ghost" onClick={()=>applyReaper(item.id)}>Apply Cleanup</button>:<button className="ghost" disabled>Review only</button>}</div>
  </article>;
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
function ServerMorningBriefPanel({brief,open}:{brief:ServerBrief|null;open:(m:{title:string;body:React.ReactNode})=>void}){
  if(!brief) return <Panel title="Morning Brief API" badge="loading"><p className="muted">Building server-side brief from feed, context map, and evidence receipts.</p></Panel>;
  return <Panel title="Morning Brief API" badge={`${new Date(brief.generatedAt).toLocaleTimeString()}${brief.degraded?' · degraded':''}`}>
    <div className="briefApi">
      <p className="eyebrow">SERVER BRIEF</p>
      <h3>{brief.headline}</h3>
      <p className="muted"><b>Ship:</b> {brief.shipNext}</p>
      <p className="muted"><b>Avoid:</b> {brief.avoidToday}</p>
      <div className="chips">
        <button className="primary hot" style={{width:'auto'}} onClick={()=>open({title:'Morning brief markdown',body:<CopyBlock text={brief.markdown}/>})}>Copy Brief</button>
        <button className="ghost" onClick={()=>open({title:'Safest next prompt',body:<CopyBlock text={brief.safestNextPrompt}/>})}>Safest Prompt</button>
      </div>
    </div>
    <ul className="summaryList briefNeeds">{brief.needsYou.slice(0,4).map((item,idx)=><li key={`${idx}-${item}`}>{item}</li>)}</ul>
  </Panel>;
}
function ContextMapPanel({contextMap,open,reload}:{contextMap:ContextMap|null;open:(m:{title:string;body:React.ReactNode})=>void;reload:()=>void}){
  if(!contextMap) return <Panel title="Context Map" badge="loading"><p className="muted">Collecting repo, vault, OpenWiki, tool, and verify receipts.</p></Panel>;
  const readFirst=contextMap.receipts.filter(r=>r.readFirst);
  return <Panel title="Context Map" badge={`${contextMap.receipts.length} receipt(s) · ${contextMap.project}`}>
    <p className="muted"><b>Next:</b> {contextMap.nextBestAction}</p>
    <p className="muted"><b>Blocker:</b> {contextMap.blocker}</p>
    <div className="receiptGrid">{readFirst.slice(0,5).map(r=><button key={`${r.kind}-${r.pathOrUrl}-${r.title}`} className="receipt" onClick={()=>open({title:`Receipt · ${r.title}`,body:<ReceiptDetail receipt={r}/>})}><span className="tag">{r.kind}</span><b>{r.title}</b><small>{r.freshness}</small></button>)}</div>
    {contextMap.missingKnowledge.length>0&&<p className="bad inline">{contextMap.missingKnowledge[0]}</p>}
    <div className="chips">
      <button className="ghost" onClick={()=>open({title:`Context prompt · ${contextMap.project}`,body:<CopyBlock text={contextMap.copyPrompt}/>})}>Copy Context Prompt</button>
      <button className="ghost" onClick={reload}>Refresh</button>
    </div>
  </Panel>;
}
function ReceiptDetail({receipt}:{receipt:SourceReceipt}){
  return <div><dl><dt>kind</dt><dd>{receipt.kind}</dd><dt>path/url</dt><dd>{receipt.pathOrUrl}</dd><dt>freshness</dt><dd>{receipt.freshness}</dd><dt>confidence</dt><dd>{receipt.confidence}</dd><dt>read first</dt><dd>{receipt.readFirst?'yes':'no'}</dd><dt>sensitive</dt><dd>{receipt.sensitive?'local/private':'public or non-local'}</dd></dl><p className="muted">Agents should quote this receipt when relying on it, and stop if it contradicts the task.</p></div>;
}
function RuntimeSafetyPanel({registry,open,reload}:{registry:AgentRuntimeRegistry|null;open:(m:{title:string;body:React.ReactNode})=>void;reload:()=>void}){
  if(!registry) return <Panel title="Agent Runtime Safety" badge="loading"><p className="muted">Reading runtime registry and control-panel safety flags.</p></Panel>;
  const rec=registry.runtimes.find(r=>r.id===registry.recommendedRuntimeId) || registry.runtimes[0];
  const flags=registry.safety;
  return <Panel title="Agent Runtime Safety" badge={`recommended: ${rec?.name || 'none'}`}>
    <div className="safetyConsole">
      <div className="flagRow"><span className={flags.safeMode?'ok':'bad'}>safe {String(flags.safeMode)}</span><span className={flags.allowShell?'bad':'ok'}>shell {String(flags.allowShell)}</span><span className={flags.allowPush?'bad':'ok'}>push {String(flags.allowPush)}</span><span className={flags.allowDestructive?'bad':'ok'}>destructive {String(flags.allowDestructive)}</span></div>
      <p className="muted">{registry.recommendationReason}</p>
      <div className="runtimeList">{registry.runtimes.map(r=><button key={r.id} className={`runtime ${r.id===registry.recommendedRuntimeId?'active':''}`} onClick={()=>open({title:`Runtime · ${r.name}`,body:<RuntimeDetail runtime={r}/>})}><b>{r.name}</b><small>{r.status} · {r.kind} · ceiling {r.safetyCeiling}</small></button>)}</div>
      <button className="ghost wide" onClick={reload}>Refresh runtime registry</button>
    </div>
  </Panel>;
}
function RuntimeDetail({runtime}:{runtime:AgentRuntime}){
  return <div><dl><dt>path</dt><dd>{runtime.pathHint}</dd><dt>modes</dt><dd>{runtime.allowedModes.join(', ')}</dd><dt>tasks</dt><dd>{runtime.preferredTasks.join(', ')}</dd><dt>bridge</dt><dd>{runtime.bridgeAware?'aware':'not needed'}</dd><dt>trace</dt><dd>{runtime.lastTraceHint}</dd></dl><h3>Validation</h3><ul className="summaryList">{runtime.validationCommands.map(c=><li key={c}>{c}</li>)}</ul><h3>Forbidden</h3><ul className="summaryList">{runtime.forbidden.map(c=><li key={c}>{c}</li>)}</ul></div>;
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

function CommandPalette({actions,loops,projects,close,exec}:{actions:Action[];loops:LoopState[];projects:ProjectStatus[];close:()=>void;exec:{runAction:(id:string)=>void;setTab:(t:Tab)=>void;openLoopPrompt:(l:LoopState)=>void}}){
  const [q,setQ]=useState(''); const [sel,setSel]=useState(0); const inputRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{ inputRef.current?.focus(); },[]);
  type Item = { key:string; kind:'tab'|'action'|'loop'|'project'; label:string; hint:string; safety?:SafetyLevel; go:()=>void };
  const items:Item[]=useMemo(()=>{
    const all:Item[]=[
      ...TABS.map(t=>({key:`tab-${t}`,kind:'tab' as const,label:`Go to ${t}`,hint:'tab',go:()=>{exec.setTab(t);close();}})),
      {key:'page-taskgate',kind:'tab' as const,label:'Go to TASK GATE',hint:'page',go:()=>{close();location.href='/sessions';}},
      {key:'page-openwiki',kind:'tab' as const,label:'Go to OPENWIKI',hint:'page',go:()=>{close();location.href='/openwiki';}},
      ...actions.map(a=>({key:`act-${a.id}`,kind:'action' as const,label:a.label,hint:`${a.category} · ${a.enabled?a.description:a.disabledReason||'disabled'}`,safety:a.safetyLevel,go:()=>{close();exec.runAction(a.id);}})),
      ...loops.map(l=>({key:`loop-${l.def.id}`,kind:'loop' as const,label:`Loop: ${l.def.name}`,hint:`${l.status} · copy runner prompt`,safety:l.def.safetyCeiling,go:()=>{close();exec.openLoopPrompt(l);}})),
      ...projects.map(p=>({key:`proj-${p.query}`,kind:'project' as const,label:`Project: ${p.matchedProject||p.query}`,hint:p.nextBestAction.slice(0,80),go:()=>{exec.setTab('WORK');close();}})),
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

function decisionClass(decision?:LoopUsefulnessAudit['decision']){
  return decision==='keep'?'ok':decision==='remove'?'bad':decision==='merge'?'merge':'revise';
}
// Loop Doctor lives on the cards; the deck badge carries the aggregate line.
function deckBadge(loops:AuditedLoopState[]){
  const audits=loops.map(l=>l.audit).filter(Boolean) as LoopUsefulnessAudit[];
  if(!audits.length) return 'prompts out · evidence in · MAZos never executes';
  const avg=Math.round(audits.reduce((sum,a)=>sum+a.score,0)/audits.length);
  const count=(d:LoopUsefulnessAudit['decision'])=>audits.filter(a=>a.decision===d).length;
  return `doctor ${avg}/100 avg · ${count('keep')} keep · ${count('revise')} revise · ${count('merge')} merge · ${count('remove')} remove`;
}

type AgentPrepView='Handoff'|'Context'|'Router'|'Runtime';
const AGENT_PREP_VIEWS:AgentPrepView[]=['Handoff','Context','Router','Runtime'];
function AgentPrepPanel({statuses,contextMap,reloadContext,routerTask,setRouterTask,routerRecs,routerBusy,route,registry,reloadRuntimes,open}:{statuses:ProjectStatus[];contextMap:ContextMap|null;reloadContext:()=>void;routerTask:string;setRouterTask:(v:string)=>void;routerRecs:ToolRec[];routerBusy:boolean;route:()=>void;registry:AgentRuntimeRegistry|null;reloadRuntimes:()=>void;open:(m:{title:string;body:React.ReactNode})=>void}){
  const [view,setView]=useState<AgentPrepView>('Handoff');
  return <section className="agentPrep">
    <div className="chips">{AGENT_PREP_VIEWS.map(v=><button key={v} className={`ghost ${view===v?'active':''}`} onClick={()=>setView(v)}>{v}</button>)}</div>
    {view==='Handoff'&&<HandoffPanel statuses={statuses} open={open}/>}
    {view==='Context'&&<ContextMapPanel contextMap={contextMap} open={open} reload={reloadContext}/>}
    {view==='Router'&&<ToolRouterPanel task={routerTask} setTask={setRouterTask} recs={routerRecs} busy={routerBusy} route={route} open={open}/>}
    {view==='Runtime'&&<RuntimeSafetyPanel registry={registry} open={open} reload={reloadRuntimes}/>}
  </section>;
}

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
  'auto':'MAZos guesses the pattern from your goal text. Prefer picking one — vague loops become permanent noise.',
  'research-intelligence':'Turn public market/competitor inputs into ranked product moves with source receipts.',
  'daily-triage':'Read state and produce the few priorities that matter now. L1 report-only.',
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

function SpinePanel({spine,brief,ship,run,open,reload}:{spine:SpineData|null;brief:ServerBrief|null;ship:ShipLogData|null;run:(id:string)=>void;open:(m:{title:string;body:React.ReactNode})=>void;reload:()=>void}){
  if(!spine) return <Panel title="Shipping Spine" badge="combining evidence…"><p className="muted">Reading project status, ship log, stale radar, decisions, playbooks…</p></Panel>;
  const v=spine.verdict; const topRow=spine.rows.find(r=>r.product===v.product);
  return <Panel title="Shipping Spine" badge={`objective · next · evidence · owner — snapshot ${new Date(spine.generatedAt).toLocaleTimeString()}`}>
    <div className="spineVerdict">
      <div>
        <p className="eyebrow">SHIP NEXT</p>
        <h3><em>{v.product}</em> — {v.action}</h3>
        <p className="muted">Why: {v.why}</p>
        <p className="muted">Owner <b>{v.owner}</b> · <SafetyBadge level={v.safety}/> · agents can read <code>/api/mazos/shipping-spine</code>{spine.savedTo?<> or {spine.savedTo.split(/[\\/]/).slice(-1)[0]}</>:null}</p>
        {brief&&<p className="muted"><b>Avoid:</b> {brief.avoidToday}</p>}
      </div>
      <div className="chips spineVerdictBtns">
        {topRow&&<button className="primary hot" onClick={()=>{navigator.clipboard.writeText(topRow.handoffPrompt); open({title:`Handoff · ${topRow.product} · ${v.owner}`,body:<CopyBlock text={topRow.handoffPrompt}/>});}}>COPY HANDOFF</button>}
        <button className="ghost" onClick={()=>open({title:'Shipping Spine · agent snapshot',body:<CopyBlock text={spine.markdown}/>})}>Agent snapshot</button>
        {brief&&<button className="ghost" onClick={()=>open({title:'Morning brief markdown',body:<CopyBlock text={brief.markdown}/>})}>Copy Brief</button>}
        <button className="ghost" onClick={reload}>Recompute</button>
      </div>
    </div>
    {brief&&<ul className="summaryList briefNeeds">{brief.needsYou.slice(0,4).map((item,idx)=><li key={`${idx}-${item}`}>{item}</li>)}</ul>}
    <div className="spineRows">{spine.rows.map(r=><SpineRowCard key={r.productId} r={r} open={open}/>)}</div>
    <div className="chips spineFooter">
      <button className="ghost" onClick={()=>run('continue_important_task')}><b>Next action prompt</b><small>from cockpit</small></button>
      <button className="ghost" onClick={()=>run('daily_triage_l1')}><b>Daily Triage L1</b><small>report-only</small></button>
      <button className="ghost" onClick={()=>run('repo_health_scan')}><b>Repo status</b><small>read-only</small></button>
      <button className="ghost" onClick={()=>run('github_update_report')}><b>GitHub report prompt</b><small>no push</small></button>
      {ship&&<button className="ghost" onClick={()=>{navigator.clipboard.writeText(ship.markdown); open({title:'Publishable update copied',body:<CopyBlock text={ship.markdown}/>});}}><b>Copy publishable update</b><small>{ship.counters.commits7d} commits 7d</small></button>}
    </div>
  </Panel>;
}
function SpineRowCard({r,open}:{r:SpineRow;open:(m:{title:string;body:React.ReactNode})=>void}){
  return <article className={`spineRow ${r.blocked?'blockedRow':''}`}>
    <div className="repoTop"><h3>{r.product}</h3><span className="rowTags"><span className={`money ${r.moneyLabel}`}>{r.moneyLabel}</span><span className="tag">{r.owner}</span><SafetyBadge level={r.safety}/>{r.blocked&&<span className="tag blockedTag">BLOCKED</span>}</span></div>
    <small className="muted">{r.objective}</small>
    <p className="spineNext"><b>NEXT:</b> {r.nextAction} <span className="dim">({r.actionSource})</span></p>
    <p><b>WHY:</b> {r.commercialReason}</p>
    <p className={r.blocked?'bad inline':'muted'}><b>BLOCKER:</b> {r.blocker}</p>
    <ul className="summaryList spineEv">{r.evidence.slice(0,3).map((e,i)=><li key={i}>{e}</li>)}</ul>
    <small className="dim">score {r.score} · {r.commits7d} commit(s)/7d · {r.dirty} dirty{r.branch?` · ${r.branch}`:''}</small>
    <div className="chips">
      <button className="ghost" onClick={()=>{navigator.clipboard.writeText(r.handoffPrompt); open({title:`Handoff · ${r.product} · ${r.owner}`,body:<CopyBlock text={r.handoffPrompt}/>});}}>Handoff</button>
      <button className="ghost" onClick={()=>open({title:`${r.product} · done when`,body:<ul className="summaryList">{r.doneCriteria.map(d=><li key={d}>{d}</li>)}</ul>})}>Done when</button>
      <button className="ghost" onClick={()=>open({title:`${r.product} · evidence paths`,body:<ul className="summaryList">{r.evidencePaths.length?r.evidencePaths.map(p=><li key={p}>{p}</li>):<li>No evidence paths recorded.</li>}</ul>})}>Evidence</button>
      {r.github&&<button className="ghost" onClick={()=>open({title:`${r.product} GitHub`,body:r.github})}>GitHub</button>}
    </div>
  </article>;
}
function StatsStrip({spine,ship,repos}:{spine:SpineData|null;ship:ShipLogData|null;repos:Repo[]}){
  if(!spine||!ship) return <Panel title="Stats" badge="no data"><p className="muted">Waiting for Shipping Spine and ship log data.</p></Panel>;
  const products=spine.rows.length;
  const blockers=spine.rows.filter(r=>r.blocked).length;
  const commits7d=ship.counters.commits7d;
  const dayMs=86400000;
  const staleAges=spine.rows.filter(r=>r.staleFindings.length>0).map(r=>{
    const repo=repos.find(rp=>rp.path&&r.repoPath&&rp.path===r.repoPath)
      || repos.find(rp=>rp.label.toLowerCase()===r.product.toLowerCase())
      || repos.find(rp=>rp.label.toLowerCase().includes(r.product.toLowerCase())||r.product.toLowerCase().includes(rp.label.toLowerCase()));
    const iso=repo?.lastCommitIso||repo?.lastModified||null;
    return iso?Math.floor((Date.now()-Date.parse(iso))/dayMs):null;
  }).filter((n):n is number=>n!==null);
  const oldestStaleDays=staleAges.length?Math.max(...staleAges):null;
  return <Panel title="Stats" badge={`snapshot ${new Date(spine.generatedAt).toLocaleTimeString()}`}>
    <div className="aiStats">
      <span><b>{products}</b> products tracked</span>
      <span><b>{oldestStaleDays!==null?`${oldestStaleDays}d`:'—'}</b> oldest stale touch</span>
      <span><b>{blockers}</b> open blockers</span>
      <span><b>{commits7d}</b> commits shipped · 7d</span>
    </div>
  </Panel>;
}

function LoopStrip(){
  return <Panel title="Operating Loop" badge="Evidence → Rank → Ship">
    <div className="massMoves loopMoves">
      <div><b>Evidence</b><span>Repo scan, ship log, stale radar, and open decisions are read fresh from disk and git — no manual status updates.</span></div>
      <div><b>Rank</b><span>The Shipping Spine scores every product on blocker state, evidence strength, and money weight, then sorts worst-blocked-first.</span></div>
      <div><b>Ship</b><span>Done means the top row&apos;s done-criteria are met and verify commands pass — the handoff prompt carries both to the owner agent.</span></div>
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

// Four live lanes: the API collapses failed-checks/system-pressure into
// blocked and stale-work/knowledge-gaps into watch.
const LANES: {id:FeedLane; label:string}[] = [
  {id:'needs-decision',label:'Needs Decision'},
  {id:'blocked',label:'Blocked / Failed'},
  {id:'ready-to-ship',label:'Ready to Ship'},
  {id:'watch',label:'Watch'},
];
const PARKED_STATES:FeedUserState[]=['done','cleared','snoozed'];
function ago(iso:string){ const m=Math.max(0,Math.round((Date.now()-new Date(iso).getTime())/60000)); if(m<60) return `${m}m`; const h=Math.round(m/60); if(h<48) return `${h}h`; return `${Math.round(h/24)}d`; }
function laneOf(i:FeedItem):FeedLane{ return PARKED_STATES.includes(i.userState)?'done':i.lane; }

function FeedPanel({feed,reload,open,goNow,setState}:{feed:FeedData|null;reload:()=>void;open:(m:{title:string;body:React.ReactNode})=>void;goNow:()=>void;setState:(id:string,s:FeedUserState)=>void}){
  const [selId,setSelId]=useState<string|null>(null);
  const [q,setQ]=useState('');
  const [rec,setRec]=useState<FlightRecord|null>(null);
  const items=useMemo(()=>{ const all=feed?.items||[]; const needle=q.trim().toLowerCase(); return needle?all.filter(i=>`${i.title} ${i.summary} ${i.product||''} ${i.type}`.toLowerCase().includes(needle)):all; },[feed,q]);
  const live=items.filter(i=>laneOf(i)!=='done'); const parked=items.filter(i=>laneOf(i)==='done');
  const sel=items.find(i=>i.id===selId)||live[0]||items[0]||null;
  useEffect(()=>{ if(!sel){ setRec(null); return; } let stop=false;
    mazosFetch(`/api/mazos/flight-recorder?id=${encodeURIComponent(sel.id)}${sel.product?`&product=${encodeURIComponent(sel.product)}`:''}`).then(r=>r.json()).then(r=>{ if(!stop) setRec(r); }).catch(()=>{ if(!stop) setRec(null); });
    if(sel.userState==='unread') setState(sel.id,'seen');
    return ()=>{ stop=true; };
  },[sel?.id]);
  useEffect(()=>{ const h=(e:KeyboardEvent)=>{ if((e.target as HTMLElement).closest('input,textarea,select')) return; if(e.key!=='ArrowDown'&&e.key!=='ArrowUp') return; e.preventDefault(); const list=[...live,...parked]; const idx=Math.max(0,list.findIndex(i=>i.id===(sel?.id))); const next=list[Math.min(list.length-1,Math.max(0,idx+(e.key==='ArrowDown'?1:-1)))]; if(next) setSelId(next.id); }; window.addEventListener('keydown',h); return()=>window.removeEventListener('keydown',h); },[live,parked,sel?.id]);
  if(!feed) return <Panel title="Operator Inbox" badge="aggregating local evidence…"><p className="muted">Reading Shipping Spine, decisions, runs, ship log, stale radar, intake queue, OpenWiki, and system internals.</p></Panel>;
  return <>
    <MorningBrief feed={feed} items={feed.items} open={open} goNow={goNow}/>
    <Panel title="Operator Inbox" badge={`${feed.filters.unreadCount} unread · ${feed.filters.attentionCount} attention · ${feed.mode}${feed.degraded?' · degraded':''}`}>
      <div className="inboxTools">
        <input className="input slim" placeholder="Search all items, including done…" value={q} onChange={e=>setQ(e.target.value)}/>
        <button className="ghost" onClick={reload}>Refresh</button>
        {feed.warnings.length>0&&<button className="ghost" onClick={()=>open({title:'Degraded sources',body:<ul className="summaryList">{feed.warnings.map(w=><li key={w}>{w}</li>)}</ul>})}>degraded ({feed.warnings.length})</button>}
      </div>
      <div className="inboxLayout">
        <div className="inboxList">
          {LANES.map(lane=>{ const rows=live.filter(i=>laneOf(i)===lane.id); if(!rows.length) return null; return <div key={lane.id} className="inboxLane">
            <p className={`laneHead lane-${lane.id}`}>{lane.label} <span>{rows.length}</span></p>
            {rows.map(i=><InboxRow key={i.id} i={i} sel={sel?.id===i.id} pick={()=>setSelId(i.id)}/>)}
          </div>; })}
          {live.length===0&&<p className="muted inboxEmpty">Inbox zero. Nothing needs you — ship the spine priority or step away.</p>}
          {parked.length>0&&<details className="inboxDone"><summary>Done / Cleared · {parked.length}</summary>{parked.map(i=><InboxRow key={i.id} i={i} sel={sel?.id===i.id} pick={()=>setSelId(i.id)}/>)}</details>}
        </div>
        <div className="inboxDetail">{sel?<DetailPane i={sel} rec={rec} open={open} setState={setState}/>:<p className="muted">Select an item.</p>}</div>
      </div>
    </Panel>
  </>;
}

function MorningBrief({feed,items,open,goNow}:{feed:FeedData;items:FeedItem[];open:(m:{title:string;body:React.ReactNode})=>void;goNow:()=>void}){
  const live=items.filter(i=>!PARKED_STATES.includes(i.userState));
  const count=(l:FeedLane)=>live.filter(i=>laneOf(i)===l).length;
  const spine=live.find(i=>i.type==='shipping-spine');
  const pressure=live.find(i=>i.type==='system');
  const top=live[0];
  const ignore=[...live].reverse().find(i=>i.lane==='watch'&&!i.requiresAttention);
  const stat=(n:number,label:string)=> n>0?<span className="briefStat hotStat"><b>{n}</b> {label}</span>:<span className="briefStat"><b>0</b> {label}</span>;
  return <section className="panel brief">
    <div className="panelHead"><h2>Morning Command Brief</h2><small>{new Date(feed.generatedAt).toLocaleTimeString()} · {feed.filters.unreadCount} unread</small></div>
    <div className="briefShip">
      <div><p className="eyebrow">SHIP NEXT</p><h3>{spine?`${spine.product} — ${spine.summary}`:feed.verdict.headline}</h3>
        {feed.verdict.changedWhatShipsNext&&<p className="bad inline">Something outranked the Shipping Spine today — read Needs Decision / Failed Checks first.</p>}
      </div>
      <div className="chips briefBtns">
        {top?.copyPrompt&&<button className="primary hot" style={{width:'auto'}} onClick={()=>{navigator.clipboard.writeText(top.copyPrompt||''); open({title:`Safest next prompt · ${top.title}`,body:<CopyBlock text={top.copyPrompt||''}/>});}}>SAFEST NEXT PROMPT</button>}
        <button className="ghost" onClick={goNow}>Spine (NOW)</button>
      </div>
    </div>
    <div className="briefStats">
      {stat(count('needs-decision'),'decisions')}
      {stat(count('blocked'),'blocked / failed')}
      {stat(count('ready-to-ship'),'ready')}
      {stat(count('watch'),'watch')}
      {pressure&&<span className="briefStat hotStat"><b>!</b> {pressure.title}</span>}
      {ignore&&<span className="briefStat dimStat">ignore: {ignore.title.slice(0,60)}</span>}
    </div>
  </section>;
}

function InboxRow({i,sel,pick}:{i:FeedItem;sel:boolean;pick:()=>void}){
  return <button className={`inboxRow ${sel?'sel':''} ${i.userState==='unread'?'unread':''}`} onClick={pick}>
    <span className={`rowDot eq-${i.evidenceQuality} ${i.requiresAttention?'hot':''}`}/>
    <span className="rowMain"><b>{i.title}</b><small>{i.summary}</small></span>
    <span className="rowMeta">{i.product&&<span className="tag">{i.product}</span>}<span className="tag">{i.score}</span><small>{ago(i.createdAt)}</small></span>
  </button>;
}

function DetailPane({i,rec,open,setState}:{i:FeedItem;rec:FlightRecord|null;open:(m:{title:string;body:React.ReactNode})=>void;setState:(id:string,s:FeedUserState)=>void}){
  const bd=i.scoreBreakdown;
  const parts=([['urgency',bd.urgency],['revenue',bd.revenue],['blocker',bd.blocker],['evidence',bd.evidence],['risk',bd.risk],['recency',bd.recency],['spine fit',bd.shippingSpineFit],['pressure',bd.systemPressure]] as [string,number][]).filter(([,v])=>v!==0);
  return <article className="detail">
    <div className="repoTop"><h3>{i.title}</h3><span className="rowTags"><span className="tag">{i.type}</span><SafetyBadge level={i.safety}/><span className={`tag eqTag eq-${i.evidenceQuality}`}>evidence {i.evidenceQuality}</span></span></div>
    <small className="dim">{new Date(i.createdAt).toLocaleString()} · {i.source} · {i.status} · {i.userState}</small>
    <p className="detailSummary">{i.summary}</p>
    <p><b>Why:</b> {i.whyItMatters}</p>
    <p><b>Next:</b> {i.nextAction}</p>
    <div className="scoreLine" title="Why this rank">score {bd.total} = {parts.map(([k,v])=>`${k} ${v>0?'+':''}${v}`).join(' · ')}</div>
    {i.evidence.length>0&&<><p className="detailLabel">EVIDENCE</p><ul className="summaryList">{i.evidence.slice(0,4).map(e=><li key={e}>{e}</li>)}</ul></>}
    {i.evidencePaths.length>0&&<><p className="detailLabel">READ FIRST</p><ul className="summaryList pathList">{i.evidencePaths.slice(0,3).map(p=><li key={p}>{p}</li>)}</ul></>}
    <p className="detailLabel">FLIGHT RECORDER</p>
    {!rec&&<p className="muted">Loading logged history…</p>}
    {rec&&rec.events.length===0&&<p className="muted">Nothing logged for this item yet.</p>}
    {rec&&rec.events.length>0&&<div className="flight">{rec.events.slice(0,8).map((e,idx)=><div key={idx} className={`flightEv ${e.ok===false?'bad':''}`}><small>{e.at?ago(e.at):'—'}</small><span className="tag">{e.kind}</span><span>{e.label}</span></div>)}</div>}
    {rec&&rec.notVerified.length>0&&<ul className="summaryList notVerified">{rec.notVerified.map(n=><li key={n}>{n}</li>)}</ul>}
    <div className="chips detailActions">
      {i.copyPrompt&&<button className="primary hot" style={{width:'auto'}} onClick={()=>{navigator.clipboard.writeText(i.copyPrompt||''); open({title:`Prompt · ${i.title}`,body:<CopyBlock text={i.copyPrompt||''}/>});}}>COPY PROMPT</button>}
      <button className="ghost" title="Score this as an agent task in the Task Gate" onClick={()=>{localStorage.setItem('mazos-taskgate-draft',JSON.stringify({task:`${i.nextAction}\n\nContext: [${i.type}${i.product?` · ${i.product}`:''}] ${i.title} — ${i.summary}`,product:i.product||''})); location.href='/sessions';}}>→ Task Gate</button>
      {i.href&&<button className="ghost" onClick={()=>{ if(i.href!.startsWith('http')||i.href!.startsWith('/api/')) window.open(i.href,'_blank','noreferrer'); else if(i.href!.startsWith('/#')){ localStorage.setItem('mazos-tab',i.href!.slice(2)); location.href='/'; } else location.href=i.href!; }}>Open</button>}
    </div>
    <div className="chips stateActions">
      {(['saved','snoozed','done','cleared'] as FeedUserState[]).map(s=><button key={s} className={`ghost ${i.userState===s?'active':''}`} onClick={()=>setState(i.id,i.userState===s?'seen':s)}>{s==='snoozed'?'snooze':s}</button>)}
      {i.userState!=='unread'&&<button className="ghost" onClick={()=>setState(i.id,'unread')}>mark unread</button>}
    </div>
  </article>;
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
function ActionLine({a,run,busy}:{a?:Action;run:(id:string)=>void;busy:string}){ if(!a)return null; const mode=a.handler==='command'?'runs command':a.handler==='repo'?'reads repos':a.handler==='vault'?'writes scan files':'manual prompt'; return <button title={a.disabledReason||a.expectedOutput} disabled={!a.enabled||!!busy} onClick={()=>run(a.id)} className="ghost action"><span className="actionHead"><b>{busy===a.id?'… ':''}{a.label}</b>{a.safetyLevel&&<SafetyBadge level={a.safetyLevel}/>}</span><small>{mode} · {a.enabled?a.description:a.disabledReason}</small></button> }
function Result({r}:{r:Run}){ const lines=(r.stdout||r.stderr||'').split('\n').filter(Boolean).slice(0,10); return <div><div className="consoleHead"><b>{r.label}</b><span className={r.success?'ok':'bad'}>{r.success?'OK':'FAIL'}</span></div><p className="muted">{r.commandPreview} · {r.durationMs}ms</p><ul className="summaryList">{lines.map((l,i)=><li key={i}>{l.slice(0,220)}</li>)}</ul><details><summary>raw output</summary><pre>{r.stdout||r.stderr}</pre></details><p className="muted">Next: {r.nextSuggestedAction}</p></div>}
function ServiceDetail({s}:{s:Health}){return <div><p>{s.meaning}</p><dl><dt>kind</dt><dd>{s.kind}</dd><dt>signal</dt><dd>{s.signal}</dd><dt>endpoint</dt><dd>{s.url||s.path}</dd><dt>latency</dt><dd>{s.latencyMs}ms</dd></dl></div>}
function Panel({title,badge,children}:{title:string;badge?:string;children:React.ReactNode}){return <section className="panel"><div className="panelHead"><h2>{title}</h2>{badge&&<small>{badge}</small>}</div>{children}</section>}
