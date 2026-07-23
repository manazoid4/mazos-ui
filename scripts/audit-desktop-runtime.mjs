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

const clientFiles = [...walk('src/app'), ...walk('src/components')];
for (const file of clientFiles) {
  const content = read(file);
  const isClient = /^\s*['"]use client['"];?/m.test(content);
  if (!isClient) continue;

  if (/(?:fetch|mazosFetch)\s*\(\s*[`'"]\/api\/mazos/.test(content)) {
    add(
      'blocker',
      'CLIENT_DIRECT_API',
      file,
      'Client component calls /api/mazos directly or through a page-local wrapper. Packaged desktop exports remove these route handlers; use the typed MAZos runtime client.',
    );
  }

  if (/const\s+LOCAL_BRIDGE\s*=|127\.0\.0\.1:3047/.test(content)) {
    add(
      'blocker',
      'CLIENT_LOCAL_BRIDGE',
      file,
      'Client component contains the legacy browser-to-local bridge path. The authoritative desktop runtime must use the packaged backend adapter.',
    );
  }
}

const desktopBuild = 'scripts/build-desktop.mjs';
if (fs.existsSync(path.join(root, desktopBuild))) {
  const content = read(desktopBuild);
  if (/src\/app\/api|apiDir/.test(content) && /renameSync\s*\(\s*apiDir/.test(content)) {
    add(
      'blocker',
      'API_REMOVED_FROM_DESKTOP',
      desktopBuild,
      'Desktop build moves src/app/api out of the application while client features still depend on it.',
    );
  }
}

const tauriConfig = 'src-tauri/tauri.conf.json';
if (fs.existsSync(path.join(root, tauriConfig))) {
  const config = JSON.parse(read(tauriConfig));
  if (config?.app?.security?.csp == null) {
    add('blocker', 'CSP_DISABLED', tauriConfig, 'Tauri Content Security Policy is null.');
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

if (strict && blockers.length > 0) {
  console.error('\nPackaged desktop contract failed. Do not publish or describe the desktop application as complete.');
  process.exit(1);
}
