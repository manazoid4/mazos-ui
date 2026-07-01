import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { INGEST_QUEUE, PATHS, DECISIONS_LOG } from '@/lib/mazos/paths';

// Auth/ToS-bound platforms: queued sources from these need an explicit human decision
// before any manual processing (no scraping, no auth bypass).
const TOS_BOUND = ['instagram', 'x', 'tiktok'];
function fileTosDecision(items: { url?: string; sourceType: string }[]) {
  const bound = items.filter(i => i.url && TOS_BOUND.includes(i.sourceType));
  if (!bound.length) return;
  const event = {
    id: `d-${Date.now().toString(36)}`, at: new Date().toISOString(), type: 'open', source: 'intake',
    question: `${bound.length} queued source(s) sit behind auth/ToS boundaries. Process manually?`,
    context: bound.slice(0, 5).map(i => `${i.sourceType}: ${i.url}`).join(' · ').slice(0, 500),
    options: ['approve', 'deny'],
  };
  fs.mkdirSync(path.dirname(DECISIONS_LOG), { recursive: true });
  fs.appendFileSync(DECISIONS_LOG, `${JSON.stringify(event)}\n`, 'utf8');
}

function sourceType(name: string) {
  const s = name.toLowerCase();
  if (s.includes('youtube') || s.includes('youtu.be')) return 'youtube';
  if (s.includes('instagram')) return 'instagram';
  if (s.includes('tiktok')) return 'tiktok';
  if (s.includes('twitter') || s.includes('x.com')) return 'x';
  if (s.endsWith('.pdf')) return 'pdf';
  return 'webpage';
}
async function recallPost(kind: string, urls: string[]) {
  const endpoint = kind === 'youtube' ? 'youtube' : kind === 'instagram' ? 'instagram' : '';
  if (!endpoint) return null;
  const res = await fetch(`http://localhost:3029/api/sources/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urls }), signal: AbortSignal.timeout(5000) });
  return { ok: res.ok, status: res.status, body: await res.text() };
}
function queue(items: any[]) {
  if (!items.length) return;
  fs.mkdirSync(path.dirname(INGEST_QUEUE), { recursive: true });
  fs.appendFileSync(INGEST_QUEUE, items.map(x => JSON.stringify(x)).join('\n') + '\n');
  const inbox = path.join(PATHS.obsidian, '00-INBOX');
  if (fs.existsSync(PATHS.obsidian)) {
    fs.mkdirSync(inbox, { recursive: true });
    fs.appendFileSync(path.join(inbox, 'Recall-Ingest-Queue.md'), '\n' + items.map(i => `- [ ] ${i.sourceType.toUpperCase()} ${i.url || i.fileName} #recall #${i.sourceType} ${i.tags || ''}\n  - target: ${i.target}\n  - notes: ${i.notes || ''}`).join('\n'), 'utf8');
  }
}
async function parse(req: Request) {
  const ct = req.headers.get('content-type') || '';
  if (!ct.includes('multipart/form-data')) {
    const body = await req.json().catch(() => ({}));
    return { urls: String(body.urls || body.url || '').split(/\s+/).filter(Boolean), files: [], sourceHint: body.sourceType, target: body.target || 'Recall', tags: body.tags || '', notes: body.notes || '' };
  }
  const fd = await req.formData();
  const files = fd.getAll('files').filter((x): x is File => x instanceof File);
  return { urls: String(fd.get('urls') || '').split(/\s+/).filter(Boolean), files, sourceHint: String(fd.get('sourceType') || 'auto'), target: String(fd.get('target') || 'Recall'), tags: String(fd.get('tags') || ''), notes: String(fd.get('notes') || '') };
}
export async function POST(req: Request) {
  const body = await parse(req);
  if (!body.urls.length && !body.files.length) return NextResponse.json({ success:false, error:'Add at least one URL or PDF/file' }, { status:400 });
  const uploads = path.join(process.cwd(), 'data', 'mazos', 'ingest-files'); fs.mkdirSync(uploads, { recursive:true });
  const fileItems = await Promise.all(body.files.map(async f => { const safe = `${Date.now()}-${f.name.replace(/[^a-z0-9._-]/gi,'_')}`; const savedTo = path.join(uploads, safe); fs.writeFileSync(savedTo, Buffer.from(await f.arrayBuffer())); return { fileName:f.name, savedTo, sourceType:sourceType(f.name), target:body.target, tags:body.tags, notes:body.notes, queuedAt:new Date().toISOString() }; }));
  const urlItems = body.urls.map(url => ({ url, sourceType: body.sourceHint === 'auto' || !body.sourceHint ? sourceType(url) : body.sourceHint, target: body.target, tags: body.tags, notes: body.notes, queuedAt: new Date().toISOString() }));
  const items=[...urlItems,...fileItems];
  const direct = urlItems.filter(i => ['youtube','instagram'].includes(i.sourceType));
  const queued = items.filter(i => !('url' in i) || !['youtube','instagram'].includes(i.sourceType));
  const results:any[] = [];
  try { for (const kind of ['youtube','instagram']) { const group = direct.filter(i => i.sourceType === kind); if (group.length) results.push({ kind, ...(await recallPost(kind, group.map(i=>i.url))) }); } }
  catch (e:any) { queue(direct); fileTosDecision(direct); results.push({ error: 'Recall service offline; queued fallback', detail: e.message }); }
  const failedKinds = new Set(results.filter(r => r && r.ok === false).map(r => r.kind));
  const finalQueued = [...queued, ...direct.filter(i => failedKinds.has(i.sourceType))];
  queue(finalQueued);
  fileTosDecision(finalQueued as { url?: string; sourceType: string }[]);
  return NextResponse.json({ success:true, message: queued.length || failedKinds.size ? 'queued + routed what is supported' : 'sent to Recall', accepted: items.length, direct: direct.length, queued: queued.length + failedKinds.size, results, queuePath: INGEST_QUEUE });
}
