import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { REMOTE_INTENTS, REMOTE_SNAPSHOT } from './paths';
import { sanitizeForRemote } from './remoteSanitize';
import type { RemoteSnapshot } from './remoteSnapshot';

export const REMOTE_INTENT_TYPES = [
  'task_gate_request',
  'mission_plan_request',
  'research_request',
  'note_to_local_operator',
] as const;

export type RemoteIntentType = (typeof REMOTE_INTENT_TYPES)[number];

export type RemoteIntent = {
  id: string;
  type: RemoteIntentType;
  createdAt: string;
  source: 'codex-mobile' | 'remote-web' | 'local-dev';
  status: 'queued';
  payload: Record<string, unknown>;
};

function ensureDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function canUseLocalStore() {
  return !process.env.VERCEL || process.env.MAZOS_REMOTE_FILE_STORE === '1';
}

export function saveRemoteSnapshot(snapshot: RemoteSnapshot) {
  const sanitized = sanitizeForRemote(snapshot);
  if (!canUseLocalStore()) {
    return {
      ok: false,
      stored: false,
      reason: 'No persistent remote store configured for hosted runtime.',
      redactionReport: sanitized.report,
    };
  }

  ensureDir(REMOTE_SNAPSHOT);
  fs.writeFileSync(REMOTE_SNAPSHOT, `${JSON.stringify(sanitized.value, null, 2)}\n`, 'utf8');
  return { ok: true, stored: true, path: REMOTE_SNAPSHOT, redactionReport: sanitized.report };
}

export function readLatestRemoteSnapshot(): RemoteSnapshot | null {
  try {
    if (!fs.existsSync(REMOTE_SNAPSHOT)) return null;
    const parsed = JSON.parse(fs.readFileSync(REMOTE_SNAPSHOT, 'utf8')) as RemoteSnapshot;
    return sanitizeForRemote(parsed).value;
  } catch {
    return null;
  }
}

export function parseRemoteIntent(input: unknown): RemoteIntent {
  const body = (input || {}) as Record<string, unknown>;
  const type = String(body.type || '');
  if (!REMOTE_INTENT_TYPES.includes(type as RemoteIntentType)) {
    throw new Error(`Intent type must be one of: ${REMOTE_INTENT_TYPES.join(', ')}`);
  }

  const source = ['codex-mobile', 'remote-web', 'local-dev'].includes(String(body.source))
    ? (String(body.source) as RemoteIntent['source'])
    : 'remote-web';

  const payload = typeof body.payload === 'object' && body.payload !== null && !Array.isArray(body.payload)
    ? (body.payload as Record<string, unknown>)
    : {};

  const intent: RemoteIntent = {
    id: randomUUID(),
    type: type as RemoteIntentType,
    createdAt: new Date().toISOString(),
    source,
    status: 'queued',
    payload,
  };

  return sanitizeForRemote(intent).value;
}

export function appendRemoteIntent(intent: RemoteIntent) {
  const sanitized = sanitizeForRemote(intent);
  if (!canUseLocalStore()) {
    return {
      ok: false,
      stored: false,
      reason: 'No persistent remote store configured for hosted runtime.',
      intent: sanitized.value,
      redactionReport: sanitized.report,
    };
  }

  ensureDir(REMOTE_INTENTS);
  fs.appendFileSync(REMOTE_INTENTS, `${JSON.stringify(sanitized.value)}\n`, 'utf8');
  return { ok: true, stored: true, intent: sanitized.value, redactionReport: sanitized.report };
}

export function readRemoteIntents(limit = 50): RemoteIntent[] {
  try {
    if (!fs.existsSync(REMOTE_INTENTS)) return [];
    return fs.readFileSync(REMOTE_INTENTS, 'utf8').trim().split('\n').filter(Boolean).slice(-limit).reverse()
      .map((line) => sanitizeForRemote(JSON.parse(line) as RemoteIntent).value);
  } catch {
    return [];
  }
}
