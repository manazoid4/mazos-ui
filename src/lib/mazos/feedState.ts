import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './paths';

export const FEED_STATE_FILE = path.join(DATA_DIR, 'feed-state.json');

export type FeedUserState = 'unread' | 'seen' | 'saved' | 'snoozed' | 'done' | 'cleared';

type StateEntry = { state: FeedUserState; updatedAt: string; until?: string };
type StateFile = { items: Record<string, StateEntry> };

export function readFeedState(): StateFile {
  try {
    if (!fs.existsSync(FEED_STATE_FILE)) return { items: {} };
    const parsed = JSON.parse(fs.readFileSync(FEED_STATE_FILE, 'utf8')) as StateFile;
    return parsed && typeof parsed.items === 'object' ? parsed : { items: {} };
  } catch {
    return { items: {} };
  }
}

// Returns the effective state for an item: snoozes expire back to unread.
export function stateFor(states: StateFile, id: string): FeedUserState {
  const entry = states.items[id];
  if (!entry) return 'unread';
  if (entry.state === 'snoozed' && entry.until && entry.until < new Date().toISOString()) return 'unread';
  return entry.state;
}

export function setFeedItemState(id: string, state: FeedUserState): { ok: boolean; error?: string } {
  try {
    const current = readFeedState();
    if (state === 'unread') {
      delete current.items[id];
    } else {
      current.items[id] = {
        state,
        updatedAt: new Date().toISOString(),
        // snooze until start of tomorrow, local-deterministic
        ...(state === 'snoozed' ? { until: new Date(new Date().setHours(24, 0, 0, 0)).toISOString() } : {}),
      };
    }
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FEED_STATE_FILE, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
    return { ok: true };
  } catch (error) {
    // Hosted Vercel fs is read-only: report, never throw.
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
