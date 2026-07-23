import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const serverDir = path.join(root, 'src-tauri', 'resources', 'server');
const nodeExecutable = path.join(serverDir, 'node.exe');
const serverEntry = path.join(serverDir, 'server.js');

if (process.platform !== 'win32') {
  throw new Error('Packaged desktop backend smoke test currently targets Windows.');
}
if (!fs.existsSync(nodeExecutable) || !fs.existsSync(serverEntry)) {
  throw new Error('Packaged backend resources are missing. Run the desktop build first.');
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Could not reserve a loopback port.')));
        return;
      }
      const port = address.port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const port = await reservePort();
const token = crypto.randomUUID();
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mazos-desktop-smoke-'));
const dataDir = path.join(tempRoot, 'data', 'mazos');
const researchDir = path.join(tempRoot, 'research', 'mazos');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(researchDir, { recursive: true });

const child = spawn(nodeExecutable, [serverEntry], {
  cwd: serverDir,
  env: {
    ...process.env,
    HOSTNAME: '127.0.0.1',
    PORT: String(port),
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    MAZOS_DESKTOP_TOKEN: token,
    MAZOS_DATA_DIR: dataDir,
    MAZOS_RESEARCH_DIR: researchDir,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

let stdout = '';
let stderr = '';
child.stdout.on('data', (chunk) => { stdout = `${stdout}${chunk}`.slice(-12000); });
child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-12000); });

try {
  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30000;
  let authenticatedResponse;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Packaged backend exited early with code ${child.exitCode}.\n${stderr || stdout}`);
    }
    try {
      authenticatedResponse = await fetch(`${baseUrl}/api/mazos/stats`, {
        headers: { 'x-mazos-token': token },
      });
      if (authenticatedResponse.ok) break;
    } catch {
      // The server is still starting.
    }
    await sleep(250);
  }

  if (!authenticatedResponse?.ok) {
    throw new Error(`Packaged backend did not serve an authenticated API response.\n${stderr || stdout}`);
  }

  const authenticatedBody = await authenticatedResponse.json();
  if (!Object.hasOwn(authenticatedBody, 'todayCostUsd') || !Object.hasOwn(authenticatedBody, 'contextPercent')) {
    throw new Error(`Unexpected authenticated response: ${JSON.stringify(authenticatedBody)}`);
  }

  const unauthenticated = await fetch(`${baseUrl}/api/mazos/stats`);
  if (unauthenticated.status !== 401) {
    throw new Error(`Unauthenticated desktop API request returned ${unauthenticated.status}, expected 401.`);
  }

  const preflight = await fetch(`${baseUrl}/api/mazos/stats`, {
    method: 'OPTIONS',
    headers: {
      origin: 'http://tauri.localhost',
      'access-control-request-method': 'GET',
      'access-control-request-headers': 'x-mazos-token',
    },
  });
  if (preflight.status !== 204 || preflight.headers.get('access-control-allow-origin') !== 'http://tauri.localhost') {
    throw new Error(`Desktop API CORS preflight failed with ${preflight.status}.`);
  }

  console.log(JSON.stringify({
    ok: true,
    port,
    authenticatedStatus: authenticatedResponse.status,
    unauthenticatedStatus: unauthenticated.status,
    preflightStatus: preflight.status,
  }, null, 2));
} finally {
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    sleep(5000),
  ]);
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
