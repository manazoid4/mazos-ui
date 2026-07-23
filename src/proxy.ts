import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const DESKTOP_ORIGINS = new Set([
  'http://tauri.localhost',
  'https://tauri.localhost',
  'tauri://localhost',
]);

function corsHeaders(origin: string | null) {
  const headers = new Headers();
  if (origin && DESKTOP_ORIGINS.has(origin)) headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'content-type, x-mazos-token');
  headers.set('Access-Control-Max-Age', '600');
  headers.set('Vary', 'Origin');
  return headers;
}

export function proxy(request: NextRequest) {
  const expectedToken = process.env.MAZOS_DESKTOP_TOKEN;
  if (!expectedToken) return NextResponse.next();

  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

  if (origin && !DESKTOP_ORIGINS.has(origin)) {
    return NextResponse.json({ ok: false, error: 'Origin is not allowed.' }, { status: 403, headers });
  }

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers });
  }

  if (request.headers.get('x-mazos-token') !== expectedToken) {
    return NextResponse.json({ ok: false, error: 'Desktop API authentication failed.' }, { status: 401, headers });
  }

  const response = NextResponse.next();
  for (const [name, value] of headers.entries()) response.headers.set(name, value);
  return response;
}

export const config = {
  matcher: '/api/mazos/:path*',
};
