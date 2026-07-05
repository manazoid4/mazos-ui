import { NextResponse } from 'next/server';
import { buildFeed, type FeedItemType } from '@/lib/mazos/feed';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') || 12);
  const product = url.searchParams.get('product') || undefined;
  const type = (url.searchParams.get('type') || undefined) as FeedItemType | undefined;
  const attentionOnly = url.searchParams.get('attentionOnly') === 'true';
  return NextResponse.json(await buildFeed({ limit, product, type, attentionOnly }));
}
