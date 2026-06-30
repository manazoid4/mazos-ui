import fs from 'fs';
import path from 'path';
import { RUN_DIR, today } from './paths';
import type { RunResult } from './runCommand';

export function appendRun(run: RunResult) {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  fs.appendFileSync(path.join(RUN_DIR, `${today()}.jsonl`), `${JSON.stringify(run)}\n`, 'utf8');
}

export function readRuns(limit = 10) {
  if (!fs.existsSync(RUN_DIR)) return [];
  return fs.readdirSync(RUN_DIR).filter(f => f.endsWith('.jsonl')).sort().reverse().flatMap(f =>
    fs.readFileSync(path.join(RUN_DIR, f), 'utf8').trim().split('\n').filter(Boolean).reverse().map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean)
  ).slice(0, limit);
}
