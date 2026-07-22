// scripts/build-desktop.mjs
import { renameSync, copyFileSync, existsSync, rmSync, rename } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const orig = 'next.config.js';
const desktop = 'next.config.desktop.mjs';
const backup = 'next.config.js.bak';

// The directory we need to hide from Next.js entirely during export
const apiDir = path.resolve('src/app/api');
const apiTemp = path.resolve('../.api_hidden_temp'); // Move outside the project folder entirely

console.log('[desktop-build] Cleaning cache...');
rmSync('.next', { recursive: true, force: true });

console.log('[desktop-build] Swapping next.config.js for static export...');
renameSync(orig, backup);
copyFileSync(desktop, orig.replace('.js', '.mjs'));

let movedApi = false;
try {
  if (existsSync(apiDir)) {
    console.log('[desktop-build] Hiding API directory...');
    renameSync(apiDir, apiTemp);
    movedApi = true;
  }
} catch (e) {
  console.log('[desktop-build] Could not move API directory', e);
}

try {
  execSync('npx next build', { stdio: 'inherit' });
} finally {
  console.log('[desktop-build] Restoring original files...');
  if (existsSync(backup)) {
    renameSync(backup, orig);
  }
  if (existsSync(orig.replace('.js', '.mjs'))) {
    import('node:fs').then(fs => fs.unlinkSync(orig.replace('.js', '.mjs')));
  }
  if (movedApi && existsSync(apiTemp)) {
    renameSync(apiTemp, apiDir);
  }
}
