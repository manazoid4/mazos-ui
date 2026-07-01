import { NextResponse } from 'next/server';
import { routeTask, TOOL_SOURCES } from '@/lib/mazos/toolRouter';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const task = url.searchParams.get('task') || '';
  if (!task.trim()) return NextResponse.json({ task: '', recommendations: [], sources: TOOL_SOURCES });
  return NextResponse.json({ task: task.trim(), recommendations: routeTask(task.trim()) });
}
