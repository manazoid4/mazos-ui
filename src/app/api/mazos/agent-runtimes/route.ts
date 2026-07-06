import { NextResponse } from 'next/server';
import { buildAgentRuntimeRegistry } from '@/lib/mazos/agentRuntimes';

export async function GET(req: Request) {
  const url = new URL(req.url);
  return NextResponse.json(buildAgentRuntimeRegistry(url.searchParams.get('task') || ''));
}
