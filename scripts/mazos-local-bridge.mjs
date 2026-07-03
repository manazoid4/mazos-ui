import http from 'node:http';

const PORT = Number(process.env.MAZOS_BRIDGE_PORT || 3047);
const TARGET = process.env.MAZOS_LOCAL_TARGET || 'http://127.0.0.1:3046';
const ALLOWED_PREFIX = '/api/mazos';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,authorization,x-mazos-bridge');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function json(res, status, body) {
  cors(res);
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

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/health') {
    json(res, 200, { ok: true, bridge: 'mazos-local-bridge', target: TARGET, startedAt });
    return;
  }

  if (!url.pathname.startsWith(ALLOWED_PREFIX)) {
    json(res, 404, { ok: false, error: `Only ${ALLOWED_PREFIX} routes are proxied.` });
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
    res.writeHead(upstream.status, {
      'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'x-mazos-bridge': 'local',
    });
    res.end(text);
  } catch (error) {
    json(res, 502, {
      ok: false,
      error: `Local MAZos target is unreachable at ${TARGET}. Start the local app with npm run dev -- -p 3046.`,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

const startedAt = new Date().toISOString();
server.listen(PORT, '127.0.0.1', () => {
  console.log(`MAZos local bridge listening on http://127.0.0.1:${PORT}`);
  console.log(`Proxying ${ALLOWED_PREFIX}/* to ${TARGET}`);
});
