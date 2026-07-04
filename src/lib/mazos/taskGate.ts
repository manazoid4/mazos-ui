import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './paths';
import { scoreTask, type TaskGateInput, type TaskGateOutput } from './taskScoring';

export const TASK_GATE_DIR = path.join(DATA_DIR, 'task-gates');
export const LATEST_TASK_GATE = path.join(TASK_GATE_DIR, 'latest-task-gate.json');
export const TASK_GATE_HISTORY = path.join(TASK_GATE_DIR, 'task-gate-history.jsonl');

export type SavedTaskGate = TaskGateOutput & {
  id: string;
  checkedAt: string;
  input: TaskGateInput;
};

export function evaluateTaskGate(input: TaskGateInput): SavedTaskGate {
  const output = scoreTask(input);
  const saved: SavedTaskGate = {
    ...output,
    id: `gate-${Date.now()}`,
    checkedAt: new Date().toISOString(),
    input,
  };
  saveTaskGate(saved);
  return saved;
}

export function saveTaskGate(gate: SavedTaskGate) {
  fs.mkdirSync(TASK_GATE_DIR, { recursive: true });
  fs.writeFileSync(LATEST_TASK_GATE, `${JSON.stringify(gate, null, 2)}\n`);
  fs.appendFileSync(TASK_GATE_HISTORY, `${JSON.stringify(gate)}\n`);
}

export function latestTaskGate() {
  if (!fs.existsSync(LATEST_TASK_GATE)) return null;
  return JSON.parse(fs.readFileSync(LATEST_TASK_GATE, 'utf8')) as SavedTaskGate;
}
