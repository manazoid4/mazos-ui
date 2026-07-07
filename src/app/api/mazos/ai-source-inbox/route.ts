import { NextResponse } from 'next/server';
import {
  buildSummary,
  parsePaste,
  readInbox,
  writeInbox,
  type SourceItem,
  type SourceStatus,
  type SourceType,
  type SuggestedAction,
} from '@/lib/mazos/aiSourceInbox';

export const dynamic = 'force-dynamic';

function response(items: SourceItem[]) {
  return NextResponse.json({ items, summary: buildSummary(items) });
}

export async function GET() {
  const items = readInbox();
  return response(items);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const raw = String(body.raw || body.rawInput || body.text || '').trim();
  if (!raw) return NextResponse.json({ error: 'Paste text, URLs, notes, or AI Feed captions first.' }, { status: 400 });

  const existing = readInbox();
  const parsed = parsePaste(raw, existing);
  const items = [...existing, ...parsed.added];
  writeInbox(items);
  return NextResponse.json({ items, summary: buildSummary(items), added: parsed.added, skippedDuplicates: parsed.skippedDuplicates });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || '');
  if (!id) return NextResponse.json({ error: 'Missing source item id.' }, { status: 400 });

  let found = false;
  const items = readInbox().map((item) => {
    if (item.id !== id) return item;
    found = true;
    return {
      ...item,
      status: body.status ? String(body.status) as SourceStatus : item.status,
      sourceType: body.sourceType ? String(body.sourceType) as SourceType : item.sourceType,
      notes: body.notes !== undefined ? String(body.notes) : item.notes,
      tags: Array.isArray(body.tags) ? body.tags.map(String) : item.tags,
      usefulnessScore: body.usefulnessScore !== undefined ? Number(body.usefulnessScore) : item.usefulnessScore,
      trustScore: body.trustScore !== undefined ? Number(body.trustScore) : item.trustScore,
      suggestedAction: body.suggestedAction ? String(body.suggestedAction) as SuggestedAction : item.suggestedAction,
      updatedAt: new Date().toISOString(),
    };
  });

  if (!found) return NextResponse.json({ error: 'Source item not found.' }, { status: 404 });
  writeInbox(items);
  return response(items);
}
