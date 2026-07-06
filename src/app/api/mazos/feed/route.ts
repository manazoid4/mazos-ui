import { NextResponse } from 'next/server';
import { buildFeed, type FeedItemType } from '@/lib/mazos/feed';
import { setFeedItemState, type FeedUserState } from '@/lib/mazos/feedState';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') || 12);
  const product = url.searchParams.get('product') || undefined;
  const type = (url.searchParams.get('type') || undefined) as FeedItemType | undefined;
  const attentionOnly = url.searchParams.get('attentionOnly') === 'true';
  return NextResponse.json(await buildFeed({ limit, product, type, attentionOnly }));
}

const STATES: FeedUserState[] = ['unread', 'seen', 'saved', 'snoozed', 'done', 'cleared'];

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === 'string' ? body.id : '';
  const state = STATES.includes(body.state) ? (body.state as FeedUserState) : null;
  if (!id || !state) return NextResponse.json({ ok: false, error: 'Expected { id, state } with a valid feed state.' }, { status: 400 });
  // Hosted read-only fs: result.ok=false reports degraded write instead of failing the UI.
  return NextResponse.json(setFeedItemState(id, state));
}
