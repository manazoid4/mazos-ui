import { NextResponse } from 'next/server';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const dynamic = 'force-dynamic';

// Pinned, reviewed paths: never accept a file path from the requesting browser.
const PROJECTS = [
  { id: 'maz-works', label: 'Maz Works', file: 'projects/maz-works/STATUS.md', area: 'Revenue' },
  { id: 'zawiya', label: 'Zawiya Trust demo', file: 'projects/zawiya-trust-demo/STATUS.md', area: 'Client demo' },
  { id: 'ilm', label: 'ILM / Research', file: 'projects/ilm/STATUS.md', area: 'Agents' },
  { id: 'maz-pocket', label: 'nod / MAZ Pocket', file: 'projects/maz-pocket/STATUS.md', area: 'Hardware' },
  { id: 'mazos-site', label: 'Maz Works website', file: 'projects/mazos-site/STATUS.md', area: 'Revenue' },
  { id: 'leadfinder', label: 'Lead finder', file: 'projects/leadfinder/STATUS.md', area: 'Revenue' },
] as const;

function findRoot(): string | null {
  const home = process.env.USERPROFILE || os.homedir();
  const root = process.env.MAZOS_UNIFIED_MEMORY_ROOT;
  const candidates = [
    root,
    path.join(home, 'unified-memory-database'),
    path.join(home, 'Projects', 'unified-memory-database'),
    path.join(home, 'Desktop', 'unified-memory-database'),
    path.join(process.cwd(), '..', 'unified-memory-database'),
  ];
  return candidates.find((p): p is string => Boolean(p && fs.existsSync(path.join(p, 'INDEX.md')) && fs.existsSync(path.join(p, '.git')))) || null;
}
function nextAction(text: string): string {
  const body = text.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n/, '');
  const heading = body.match(/(?:^|\n)##\s+(?:Next actions?|Next work|Next steps?)\s*\r?\n([\s\S]*?)(?=\r?\n##\s|$)/i);
  if (!heading) return 'Open project handoff for verified next action';
  const item = heading[1].split(/\r?\n/).map(s=>s.trim()).find(s=>/^([-*]|\d+\.)\s+\S/.test(s));
  return item ? item.replace(/^([-*]|\d+\.)\s+/, '').replace(/\*\*/g,'').replace(/\[[^\]]+\]\(([^)]+)\)/g, '$1').slice(0,240) : 'Review latest project handoff';
}

export async function GET() {
  if (process.env.VERCEL) return NextResponse.json({ available: false, projects: [], explanation: 'Local Unified Memory is not mounted in this preview.' }, { headers: { 'Cache-Control': 'no-store' } });
  const root = findRoot();
  if (!root) return NextResponse.json({ available: false, projects: [], explanation: 'No checked-out Unified Memory repository found on this computer.' }, { headers: { 'Cache-Control': 'no-store' } });
  const projects = PROJECTS.map(p => {
    const full = path.join(root, p.file);
    try {
      if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
      const raw = fs.readFileSync(full, 'utf8').slice(0, 32000);
      const lastVerified = raw.match(/^last_verified:\s*['"]?([^'"\r\n]+)['"]?\s*$/m)?.[1]?.trim() || null;
      const declaredState = raw.match(/^status:\s*['"]?([^'"\r\n]+)['"]?\s*$/m)?.[1]?.trim() || 'unknown';
      return { id: p.id, label: p.label, area: p.area, nextAction: nextAction(raw), declaredState, lastVerified, source: p.file };
    } catch { return null; }
  }).filter(x => x !== null);
  return NextResponse.json({ available: true, projects, explanation: 'Project status is read from the local Unified Memory checkout. Check verification dates before relying on a task.' }, { headers: { 'Cache-Control': 'no-store' } });
}
