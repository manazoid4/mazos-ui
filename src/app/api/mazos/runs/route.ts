import { NextResponse } from 'next/server';
import { readRuns } from '@/lib/mazos/logStore';
export async function GET(req: Request) { const limit = Number(new URL(req.url).searchParams.get('limit') || 10); return NextResponse.json({ runs: readRuns(limit) }); }
