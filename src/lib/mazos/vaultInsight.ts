import fs from 'fs';
import path from 'path';
import { PATHS, VAULT_INDEX, VAULT_SCAN_MD } from './paths';

const MUST = [
  'AGENTS.md','wiki/hot.md','wiki/index.md','03-MEMORY/PROMPT_LIBRARY.md','03-MEMORY/CURRENT_TASKS.md','03-MEMORY/USER_PROFILE.md','02-PROJECTS/MazOS/CURRENT.md','02-PROJECTS/Recall/CURRENT.md','02-PROJECTS/JobFilter/CURRENT.md','02-PROJECTS/Hermes/CURRENT.md'
];
const KEYWORDS = ['prompt','agent','codex','claude','recall','jobfilter','mazos','money','ship','next action','workflow','rule'];
const rel = (p:string)=>p.replaceAll('\\','/');
const strip = (s:string)=>s.replace(/```[\s\S]*?```/g,' ').replace(/[#>*_`\[\]()]/g,' ').replace(/\s+/g,' ').trim();
function readMaybe(r:string){ const p=path.join(PATHS.obsidian,r); return fs.existsSync(p)?fs.readFileSync(p,'utf8'):''; }
function titleOf(file:string, txt:string){ return (txt.match(/^#\s+(.+)$/m)?.[1] || path.basename(file,'.md')).slice(0,90); }
function bullets(txt:string, n=6){ return txt.split(/\r?\n/).map(x=>x.trim()).filter(x=>/^[-*]\s+|^\d+\.\s+/.test(x)).map(x=>strip(x).slice(0,220)).filter(Boolean).slice(0,n); }
function walk(dir:string, out:string[]=[]){ if(!fs.existsSync(dir)) return out; for(const e of fs.readdirSync(dir,{withFileTypes:true})){ const p=path.join(dir,e.name); if(e.isDirectory() && !['.git','node_modules','.obsidian'].includes(e.name) && out.length<900) walk(p,out); else if(e.isFile() && e.name.endsWith('.md')) out.push(p); } return out; }
export function vaultInsight(){
  const root=PATHS.obsidian;
  const seed=MUST.map(r=>({ rel:r, text:readMaybe(r) })).filter(x=>x.text);
  const all=walk(root).map(p=>({ path:p, rel:rel(path.relative(root,p)), stat:fs.statSync(p) })).sort((a,b)=>+b.stat.mtime-+a.stat.mtime);
  const scored=all.map(f=>{ const name=f.rel.toLowerCase(); let score=KEYWORDS.reduce((s,k)=>s+(name.includes(k)?3:0),0)+(Date.now()-+f.stat.mtime<1000*60*60*24*14?2:0); return {...f,score}; }).sort((a,b)=>b.score-a.score).slice(0,28);
  const docs=[...seed.map(s=>({rel:s.rel,text:s.text})), ...scored.map(f=>({rel:f.rel,text:fs.readFileSync(f.path,'utf8')}))];
  const promptLines=docs.flatMap(d=>bullets(d.text,12).filter(x=>/prompt|agent|codex|claude|execute|scan|review|ship|money|next/i.test(x)).map(x=>({source:d.rel,text:x}))).slice(0,24);
  const projects=['JobFilter','Recall','MazOS','OpenFlowKit','InkWeave','Zawiya','FlipSignal','SecureShift','OmniScribe'];
  const projectSignals=projects.map(name=>({ name, mentions: docs.reduce((n,d)=>n+(d.text.match(new RegExp(name,'gi'))||[]).length,0) })).filter(x=>x.mentions).sort((a,b)=>b.mentions-a.mentions);
  const summary={
    scannedAt:new Date().toISOString(), root, filesSeen:all.length,
    doctrine:['Plan → execute → verify; smallest safe version; revenue/money tasks first.','Use specialized agents for vault/repo scans; summarize, do not dump logs.','Prefer prompts/checklists when external tools need human approval.','Canonical vault is Obsidian Main Vault; read hot/index before broad search.'],
    projectSignals,
    prompts:promptLines,
    keyDocs:docs.slice(0,18).map(d=>({source:d.rel,title:titleOf(d.rel,d.text),bullets:bullets(d.text,4)})),
    cockpitPanels:['Now: one recommended next action with evidence','Intake Queue: sources grouped by YouTube/Instagram/X/PDF/web','Vault Intel: modal summaries sourced from hot/index/project CURRENT','Repo Command: clean status cards; actions return summary + next prompt, raw log hidden behind details']
  };
  fs.mkdirSync(path.dirname(VAULT_INDEX),{recursive:true});
  fs.writeFileSync(VAULT_INDEX,JSON.stringify(summary,null,2));
  fs.writeFileSync(VAULT_SCAN_MD,`# Vault Intelligence\n\nScanned: ${summary.scannedAt}\nFiles seen: ${all.length}\n\n## Doctrine\n${summary.doctrine.map(x=>`- ${x}`).join('\n')}\n\n## Project signals\n${projectSignals.map(x=>`- ${x.name}: ${x.mentions}`).join('\n')}\n\n## Useful prompts\n${promptLines.slice(0,12).map(x=>`- ${x.text} _(source: ${x.source})_`).join('\n')}\n`);
  return summary;
}
