import { NextResponse } from 'next/server';
import { vaultInsight } from '@/lib/mazos/vaultInsight';

export async function GET() {
  return NextResponse.json(vaultInsight());
}
