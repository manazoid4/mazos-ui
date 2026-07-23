import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const originalConfig = path.join(root, 'next.config.js');
const temporaryConfig = path.join(root, 'next.config.mjs');
const backupConfig = path.join(root, 'next.config.js.desktop-backup');
const apiDir = path.join(root, 'src', 'app', 'api');
const apiTemp = path.join(root, '.desktop-build-api-temp');
const serverResources = path.join(root, 'src-tauri', 'resources', 'server');

if (process.platform !== 'win32') {
  throw new Error('The current MAZos desktop bundle targets Windows and must be built on Windows.');
}

function runNextBuild() {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  execFileSync(npx, ['next', 'build'], { cwd: root, stdio: 'inherit' });
}

function withNextConfig(configPath, callback) {
  if (existsSync(backupConfig) || existsSync(temporaryConfig)) {
    throw new Error('A previous desktop build did not restore Next.js configuration cleanly.');
  }

  renameSync(originalConfig, backupConfig);
  copyFileSync(path.join(root, configPath), temporaryConfig);
  try {
    callback();
  } finally {
    rmSync(temporaryConfig, { force: true });
    if (existsSync(backupConfig)) renameSync(backupConfig, originalConfig);
  }
}

function buildStandaloneBackend() {
  console.log('[desktop-build] Building standalone Next.js backend...');
  rmSync(path.join(root, '.next'), { recursive: true, force: true });
  rmSync(serverResources, { recursive: true, force: true });

  withNextConfig('next.config.server.mjs', runNextBuild);

  const standalone = path.join(root, '.next', 'standalone');
  if (!existsSync(path.join(standalone, 'server.js'))) {
    throw new Error('Next.js standalone backend did not produce .next/standalone/server.js.');
  }

  mkdirSync(serverResources, { recursive: true });
  cpSync(standalone, serverResources, { recursive: true });
  cpSync(path.join(root, '.next', 'static'), path.join(serverResources, '.next', 'static'), { recursive: true });

  const publicDir = path.join(root, 'public');
  if (existsSync(publicDir)) cpSync(publicDir, path.join(serverResources, 'public'), { recursive: true });

  const configDir = path.join(root, 'config');
  if (existsSync(configDir)) cpSync(configDir, path.join(serverResources, 'config'), { recursive: true });

  copyFileSync(process.execPath, path.join(serverResources, 'node.exe'));
  writeFileSync(
    path.join(serverResources, 'mazos-runtime-manifest.json'),
    `${JSON.stringify({ builtAt: new Date().toISOString(), node: process.version }, null, 2)}\n`,
  );
}

function buildStaticFrontend() {
  console.log('[desktop-build] Building static Tauri frontend...');
  rmSync(path.join(root, '.next'), { recursive: true, force: true });
  rmSync(path.join(root, 'out'), { recursive: true, force: true });
  rmSync(apiTemp, { recursive: true, force: true });

  let movedApi = false;
  try {
    if (existsSync(apiDir)) {
      renameSync(apiDir, apiTemp);
      movedApi = true;
    }
    withNextConfig('next.config.desktop.mjs', runNextBuild);
  } finally {
    if (movedApi && existsSync(apiTemp)) renameSync(apiTemp, apiDir);
    rmSync(apiTemp, { recursive: true, force: true });
  }

  if (!existsSync(path.join(root, 'out', 'index.html'))) {
    throw new Error('Desktop static frontend did not produce out/index.html.');
  }
}

try {
  buildStandaloneBackend();
  buildStaticFrontend();
  console.log('[desktop-build] Standalone backend and static frontend are ready for Tauri packaging.');
} catch (error) {
  if (existsSync(backupConfig) && !existsSync(originalConfig)) renameSync(backupConfig, originalConfig);
  if (existsSync(apiTemp) && !existsSync(apiDir)) renameSync(apiTemp, apiDir);
  throw error;
}
