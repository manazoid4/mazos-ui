import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const strict = process.argv.includes('--strict');
const findings = [];

function add(severity, code, file, detail) {
  findings.push({ severity, code, file, detail });
}

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function walk(relative) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return [];
  const output = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) output.push(...walk(child));
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) output.push(child);
  }
  return output;
}

const runtimeClient = 'src/lib/mazos/runtimeClient.ts';
const runtimeClientContent = fs.existsSync(path.join(root, runtimeClient)) ? read(runtimeClient) : '';
const hasFetchAdapter = /installDesktopFetchAdapter/.test(runtimeClientContent)
  && /backend_connection/.test(runtimeClientContent)
  && /x-mazos-token/.test(runtimeClientContent);

const desktopBuild = 'scripts/build-desktop.mjs';
const desktopBuildContent = fs.existsSync(path.join(root, desktopBuild)) ? read(desktopBuild) : '';
const hasStandaloneBackend = /next\.config\.server\.mjs/.test(desktopBuildContent)
  && /standalone/.test(desktopBuildContent)
  && /serverResources/.test(desktopBuildContent)
  && /node\.exe/.test(desktopBuildContent);

if (!hasFetchAdapter) {
  add('blocker', 'DESKTOP_FETCH_ADAPTER_MISSING', runtimeClient, 'Packaged UI has no authenticated adapter for /api/mazos calls.');
}
if (!hasStandaloneBackend) {
  add('blocker', 'STANDALONE_BACKEND_MISSING', desktopBuild, 'Desktop build does not package the full Next.js backend.');
}

const clientFiles = [...walk('src/app'), ...walk('src/components')];
for (const file of clientFiles) {
  const content = read(file);
  const isClient = /^\s*['"]use client['"];?/m.test(content);
  if (!isClient) continue;

  if (/(?:fetch|mazosFetch)\s*\(\s*[`'"]\/api\/mazos/.test(content)) {
    add(
      hasFetchAdapter && hasStandaloneBackend ? 'warning' : 'blocker',
      'CLIENT_COMPAT_API',
      file,
      hasFetchAdapter && hasStandaloneBackend
        ? 'Client still uses a compatibility API call. The pre-mount desktop adapter authenticates and redirects it to the packaged backend; migrate to the typed client incrementally.'
        : 'Client calls /api/mazos without a complete packaged adapter/backend.',
    );
  }

  if (/const\s+LOCAL_BRIDGE\s*=|127\.0\.0\.1:3047/.test(content)) {
    add(
      'warning',
      'LEGACY_HOSTED_BRIDGE',
      file,
      'Legacy hosted browser bridge remains. It must never be the authoritative desktop execution path.',
    );
  }
}

if (/src\/app\/api|apiDir/.test(desktopBuildContent) && /renameSync\s*\(\s*apiDir/.test(desktopBuildContent)) {
  add(
    hasStandaloneBackend ? 'info' : 'blocker',
    'STATIC_FRONTEND_EXCLUDES_SERVER_ROUTES',
    desktopBuild,
    hasStandaloneBackend
      ? 'Expected: server routes are excluded only from the static frontend after a standalone backend has been packaged.'
      : 'Desktop export removes API routes without packaging an alternative backend.',
  );
}

const proxyFile = 'src/proxy.ts';
const proxyContent = fs.existsSync(path.join(root, proxyFile)) ? read(proxyFile) : '';
if (!/MAZOS_DESKTOP_TOKEN/.test(proxyContent) || !/x-mazos-token/.test(proxyContent)) {
  add('blocker', 'DESKTOP_API_AUTH_MISSING', proxyFile, 'Packaged backend API boundary does not enforce the ephemeral desktop token.');
}

const tauriConfig = 'src-tauri/tauri.conf.json';
if (fs.existsSync(path.join(root, tauriConfig))) {
  const config = JSON.parse(read(tauriConfig));
  if (config?.app?.security?.csp == null) {
    add('blocker', 'CSP_DISABLED', tauriConfig, 'Tauri Content Security Policy is null.');
  }
  const resources = config?.bundle?.resources || [];
  if (!resources.some((entry) => String(entry).includes('resources/server'))) {
    add('blocker', 'BACKEND_NOT_BUNDLED', tauriConfig, 'Tauri bundle does not include packaged backend resources.');
  }
}

const commandsFile = 'src-tauri/src/commands.rs';
if (fs.existsSync(path.join(root, commandsFile))) {
  const content = read(commandsFile);
  if (/current_dir\s*\(\s*&repo_path\s*\)/.test(content)) {
    add(
      'blocker',
      'UNSCOPED_REPOSITORY_PATH',
      commandsFile,
      'Renderer-supplied repository paths reach Git without validation against a confirmed workspace registry.',
    );
  }
  for (const required of ['start_backend', 'stop_backend', 'backend_connection', 'MAZOS_DESKTOP_TOKEN']) {
    if (!content.includes(required)) add('blocker', 'BACKEND_LIFECYCLE_INCOMPLETE', commandsFile, `Missing desktop backend primitive: ${required}.`);
  }
}

const toolkitRoute = 'src/app/api/mazos/toolkit/route.ts';
if (fs.existsSync(path.join(root, toolkitRoute))) {
  const content = read(toolkitRoute);
  if (/useCount:\s*0/.test(content)) {
    add('warning', 'STATIC_SKILL_USAGE', toolkitRoute, 'Top skill usage is curated placeholder data, not measured usage.');
  }
  if (/connected:\s*true/.test(content)) {
    add('warning', 'CONFIG_IS_NOT_HEALTH', toolkitRoute, 'MCP configuration presence is labelled as a live connection.');
  }
}

const statsRoute = 'src/app/api/mazos/stats/route.ts';
if (fs.existsSync(path.join(root, statsRoute))) {
  const content = read(statsRoute);
  if (/todayCostUsd:\s*null/.test(content) || /contextPercent:\s*null/.test(content)) {
    add('warning', 'PLACEHOLDER_STATS', statsRoute, 'Cost/context statistics are unavailable placeholders.');
  }
}

const rank = { blocker: 0, warning: 1, info: 2 };
findings.sort((a, b) => rank[a.severity] - rank[b.severity] || a.file.localeCompare(b.file));

console.log('# MAZos desktop runtime audit');
console.log(`Mode: ${strict ? 'strict' : 'report'}`);
console.log(`Findings: ${findings.length}`);

for (const finding of findings) {
  console.log(`\n[${finding.severity.toUpperCase()}] ${finding.code}`);
  console.log(`File: ${finding.file}`);
  console.log(finding.detail);
}

const blockers = findings.filter((finding) => finding.severity === 'blocker');
console.log(`\nBlockers: ${blockers.length}`);
console.log(`Warnings: ${findings.filter((finding) => finding.severity === 'warning').length}`);
console.log(`Info: ${findings.filter((finding) => finding.severity === 'info').length}`);

if (strict && blockers.length > 0) {
  console.error('\nPackaged desktop contract failed. Do not publish or describe the desktop application as complete.');
  process.exit(1);
}
