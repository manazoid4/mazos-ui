import http from 'node:http';

const PORT = Number(process.env.MAZOS_BRIDGE_PORT || 3047);
const TARGET = process.env.MAZOS_LOCAL_TARGET || 'http://127.0.0.1:3046';
const ALLOWED_PREFIX = '/api/mazos';
// The bridge exposes local repo/vault data to a browser page — only the hosted
// cockpit and localhost may call it, not any random site open in the browser.
const ALLOWED_ORIGINS = (process.env.MAZOS_BRIDGE_ORIGINS || 'https://mazos-command-centre.vercel.app,http://localhost:3046,http://127.0.0.1:3046')
  .split(',').map(o => o.trim()).filter(Boolean);

function cors(res, req) {
  const origin = req?.headers?.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,authorization,x-mazos-bridge');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function json(res, status, body, req) {
  cors(res, req);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

let proxied = 0, failed = 0;
const server = http.createServer(async (req, res) => {
  cors(res, req);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/health') {
    json(res, 200, { ok: true, bridge: 'mazos-local-bridge', target: TARGET, startedAt, proxied, failed, uptimeSec: Math.round(process.uptime()) }, req);
    return;
  }

  if (!url.pathname.startsWith(ALLOWED_PREFIX)) {
    json(res, 404, { ok: false, error: `Only ${ALLOWED_PREFIX} routes are proxied.` }, req);
    return;
  }

  try {
    const body = ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : await readBody(req);
    const upstream = await fetch(`${TARGET}${url.pathname}${url.search}`, {
      method: req.method,
      headers: {
        'content-type': req.headers['content-type'] || 'application/json',
        'x-mazos-bridge': 'local',
      },
      body,
      signal: AbortSignal.timeout(30_000),
    });
    const text = await upstream.text();
    proxied++;
    res.writeHead(upstream.status, {
      'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'x-mazos-bridge': 'local',
    });
    res.end(text);
  } catch (error) {
    failed++;
    json(res, 502, {
      ok: false,
      error: `Local MAZos target is unreachable at ${TARGET}. Run start-mazos-stack (or: npm run dev -- -p 3046).`,
      detail: error instanceof Error ? error.message : String(error),
    }, req);
  }
});

const startedAt = new Date().toISOString();
server.listen(PORT, '127.0.0.1', () => {
  console.log(`MAZos local bridge listening on http://127.0.0.1:${PORT}`);
  console.log(`Proxying ${ALLOWED_PREFIX}/* to ${TARGET}`);
});
