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
  // A public/cloud preview is never the owner's Windows runtime.
  // All real MAZos APIs are local-only until an explicitly authenticated
  // hosted relay has been independently audited.
  if (process.env.VERCEL) {
    return NextResponse.json(
      { ok: false, error: 'MAZos actions and private data require the authenticated local desktop runtime.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
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
  headers.forEach((value, name) => response.headers.set(name, value));
  return response;
}

export const config = {
  matcher: '/api/mazos/:path*',
};
