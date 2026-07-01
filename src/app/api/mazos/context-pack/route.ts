import { NextResponse } from 'next/server';
import { buildContextPack } from '@/lib/mazos/contextPack';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const project = url.searchParams.get('project') || '';
  if (!project.trim()) return NextResponse.json({ error: 'Missing project query' }, { status: 400 });
  return NextResponse.json(buildContextPack(project.trim()));
}
