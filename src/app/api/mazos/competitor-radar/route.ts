import { NextResponse } from 'next/server';
import { buildCompetitorRadar } from '@/lib/mazos/competitorRadar';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await buildCompetitorRadar());
}
