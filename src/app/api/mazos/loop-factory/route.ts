import { NextResponse } from 'next/server';
import { CUSTOM_LOOPS } from '@/lib/mazos/paths';
import { LOOP_FACTORY_PATTERNS, generateLoopDraft, readCustomLoops, saveCustomLoop, type LoopPatternId } from '@/lib/mazos/loopFactory';

function sourcesFrom(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  return String(value || '').split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}

export async function GET() {
  const customLoops = readCustomLoops();
  return NextResponse.json({
    patterns: LOOP_FACTORY_PATTERNS,
    customLoopCount: customLoops.length,
    path: CUSTOM_LOOPS,
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const draft = generateLoopDraft({
    goal: String(body.goal || ''),
    project: String(body.project || 'MAZos'),
    pattern: (body.pattern || 'auto') as LoopPatternId,
    sources: sourcesFrom(body.sources),
  });

  if (body.action !== 'save') {
    return NextResponse.json({ ok: true, draft });
  }

  if (draft.readiness === 'unsafe') {
    return NextResponse.json({ ok: false, draft, error: 'Loop is unsafe; tighten goal, sources, gates, and evidence before saving.' });
  }

  try {
    const loops = saveCustomLoop(draft.def);
    return NextResponse.json({ ok: true, draft, customLoopCount: loops.length, path: CUSTOM_LOOPS });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      draft,
      error: error instanceof Error ? error.message : String(error),
      path: CUSTOM_LOOPS,
    });
  }
}
