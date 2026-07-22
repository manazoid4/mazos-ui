import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    todayCostUsd: null,
    contextPercent: null,
  });
}
