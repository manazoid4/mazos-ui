import { NextResponse } from 'next/server';
import { listProfiles, getActiveProfile, readProfileDocs, writeProfileDoc, switchActiveProfile, EDITABLE_DOCS } from '@/lib/mazos/hermesProfile';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const profile = url.searchParams.get('profile') || getActiveProfile();
  return NextResponse.json({
    profiles: listProfiles(),
    active: getActiveProfile(),
    selected: profile,
    docs: readProfileDocs(profile),
    editableDocs: EDITABLE_DOCS,
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.action) return NextResponse.json({ error: 'action required' }, { status: 400 });

  try {
    if (body.action === 'switch') {
      if (!body.profile) return NextResponse.json({ error: 'profile required' }, { status: 400 });
      switchActiveProfile(String(body.profile));
      return NextResponse.json({ ok: true, active: getActiveProfile() });
    }
    if (body.action === 'save-doc') {
      if (!body.profile || !body.doc) return NextResponse.json({ error: 'profile and doc required' }, { status: 400 });
      writeProfileDoc(String(body.profile), String(body.doc), String(body.content ?? ''));
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 400 });
  }
}
