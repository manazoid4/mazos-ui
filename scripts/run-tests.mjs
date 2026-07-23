import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const testsRoot = path.join(root, 'tests');
const patterns = [/\.(?:test|spec)\.(?:ts|tsx|js|jsx|mjs|cjs)$/];

function walk(directory) {
  const output = [];
  if (!fs.existsSync(directory)) return output;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...walk(absolute));
    else if (patterns.some((pattern) => pattern.test(entry.name))) output.push(absolute);
  }
  return output;
}

const files = walk(testsRoot).sort();
if (files.length === 0) {
  console.error('No test files were found under tests/.');
  process.exit(1);
}

console.log(`Running ${files.length} test file${files.length === 1 ? '' : 's'}:`);
for (const file of files) console.log(`- ${path.relative(root, file)}`);

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(npx, ['--yes', 'tsx', '--test', ...files], {
  cwd: root,
  stdio: 'inherit',
  shell: false,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
