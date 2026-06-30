import path from 'path';

export const USER_HOME = process.env.USERPROFILE || process.env.HOME || 'C:/Users/manaz';
export const ROOT = process.cwd();
export const DATA_DIR = path.join(ROOT, 'data', 'mazos');
export const RESEARCH_DIR = path.join(ROOT, 'research', 'mazos');
export const RUN_DIR = path.join(DATA_DIR, 'runs');
export const INGEST_QUEUE = path.join(DATA_DIR, 'ingest-queue.jsonl');
export const VAULT_INDEX = path.join(DATA_DIR, 'vault-index.json');
export const VAULT_SCAN_MD = path.join(RESEARCH_DIR, 'latest-vault-scan.md');

export const PATHS = {
  mazos_ui: 'C:/Users/manaz/Projects/mazos-ui',
  recall: 'C:/Users/manaz/Projects/recall',
  jobfilter: 'C:/Users/manaz/Desktop/JobFilterV1',
  jobfilter_alt: 'C:/Users/manaz/Projects/JobFilterV1',
  openflowkit: 'C:/Users/manaz/Projects/openflowkit',
  obsidian: 'C:/Users/manaz/Desktop/Obsidian Main Vault',
  jobfilter_vault: 'C:/Users/manaz/JobFilter-Obsidian-Vault',
} as const;

export function today() { return new Date().toISOString().slice(0, 10); }
