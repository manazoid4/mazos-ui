import { NextResponse } from 'next/server';
import { buildMassCompetitorCatalog } from '@/lib/mazos/massCompetitors';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(buildMassCompetitorCatalog());
}
