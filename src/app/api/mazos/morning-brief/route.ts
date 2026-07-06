import { NextResponse } from 'next/server';
import { buildMorningBrief } from '@/lib/mazos/morningBrief';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const project = url.searchParams.get('project') || 'MAZos';
  return NextResponse.json(await buildMorningBrief(project.trim() || 'MAZos'));
}
