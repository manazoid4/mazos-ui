import { NextResponse } from 'next/server';
import { getSystemInternals } from '@/lib/mazos/systemInfo';

export async function GET() {
  return NextResponse.json(await getSystemInternals());
}
