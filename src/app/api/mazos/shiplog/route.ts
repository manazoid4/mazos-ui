import { NextResponse } from 'next/server';
import { buildShipLog } from '@/lib/mazos/shipLog';

export async function GET() {
  return NextResponse.json(buildShipLog());
}
