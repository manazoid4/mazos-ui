import { NextResponse } from 'next/server';
import { createMissionPlan } from '@/lib/mazos/missionPlanner';
import { type TaskGateInput } from '@/lib/mazos/taskScoring';

export async function POST(request: Request) {
  try {
    const input = await request.json() as TaskGateInput;
    return NextResponse.json(createMissionPlan(input));
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 400 });
  }
}
