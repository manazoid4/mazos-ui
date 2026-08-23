import { NextResponse } from 'next/server';
import { auditWebsite } from '@/lib/mazos/websiteAudit';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const website = String(body?.website || '').trim();
  if (!website) return NextResponse.json({ error: 'Website is required.' }, { status: 400 });
  try {
    return NextResponse.json({ audit: await auditWebsite(website) });
  } catch (reason) {
    const message = reason instanceof Error && reason.name === 'TimeoutError' ? 'Website check timed out after 10 seconds.' : reason instanceof Error ? reason.message : String(reason);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
