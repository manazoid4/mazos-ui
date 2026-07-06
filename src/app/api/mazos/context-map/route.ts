import { NextResponse } from 'next/server';
import { buildContextMap } from '@/lib/mazos/sourceReceipts';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const project = url.searchParams.get('project') || 'MAZos';
  return NextResponse.json(buildContextMap(project.trim() || 'MAZos'));
}
