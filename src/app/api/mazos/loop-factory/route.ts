import fs from 'fs';
import { NextResponse } from 'next/server';
import { CUSTOM_LOOPS, PATHS } from '@/lib/mazos/paths';
import { generateLoopDraft, readCustomLoops, saveCustomLoop } from '@/lib/mazos/loopFactory';
import { actions } from '@/lib/mazos/commandRegistry';

export async function GET() {
  const repoKeys = Object.entries(PATHS)
    .filter(([key, p]) => !key.endsWith('_alt') && !key.startsWith('openwiki') && typeof p === 'string' && fs.existsSync(p as string) && fs.existsSync(`${p}/package.json`))
    .map(([key]) => key);
  return NextResponse.json({
    repos: repoKeys,
    verifyActions: actions().filter(a => a.category === 'Verify' && a.enabled).map(a => ({ id: a.id, label: a.label })),
    customLoopCount: readCustomLoops().length,
    path: CUSTOM_LOOPS,
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const draft = generateLoopDraft({
    goal: String(body.goal || ''),
    repo: String(body.repo || 'mazos_ui'),
    verifyActionId: body.verifyActionId ? String(body.verifyActionId) : undefined,
    agent: body.agent,
  });

  if (body.action !== 'save') return NextResponse.json({ ok: true, draft });

  // Gate preflight is a hard lock, not advice: blockers = no save, no prompt.
  if (draft.gate.blockers.length) {
    return NextResponse.json({ ok: false, draft, error: `Gate blocked: ${draft.gate.blockers[0]}` });
  }

  try {
    const loops = saveCustomLoop(draft.def);
    return NextResponse.json({ ok: true, draft, customLoopCount: loops.length, path: CUSTOM_LOOPS });
  } catch (error) {
    return NextResponse.json({ ok: false, draft, error: error instanceof Error ? error.message : String(error) });
  }
}
