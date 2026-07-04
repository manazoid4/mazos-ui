import { NextResponse } from 'next/server';
import { evaluateTaskGate, latestTaskGate } from '@/lib/mazos/taskGate';
import { knownRepoOptions, type TaskGateInput } from '@/lib/mazos/taskScoring';

export async function GET() {
  return NextResponse.json({
    latest: latestTaskGate(),
    repos: knownRepoOptions(),
  });
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as TaskGateInput;
    return NextResponse.json(evaluateTaskGate(input));
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 400 });
  }
}
