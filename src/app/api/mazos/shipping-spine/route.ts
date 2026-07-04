import { NextResponse } from 'next/server';
import { buildShippingSpine } from '@/lib/mazos/shippingSpine';

export async function GET() {
  return NextResponse.json(buildShippingSpine());
}
