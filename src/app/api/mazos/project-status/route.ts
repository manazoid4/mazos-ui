import { NextResponse } from 'next/server';
import { latestProjectStatus } from '@/lib/mazos/projectStatus';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const project = url.searchParams.get('project') || '';
  if (!project.trim()) return NextResponse.json({ error: 'Missing project query' }, { status: 400 });
  return NextResponse.json(latestProjectStatus(project.trim()));
}
