import path from 'path';

export const USER_HOME = process.env.USERPROFILE || process.env.HOME || 'C:/Users/manaz';
export const ROOT = process.env.MAZOS_RUNTIME_ROOT || process.cwd();
export const DATA_DIR = process.env.MAZOS_DATA_DIR || path.join(ROOT, 'data', 'mazos');
export const RESEARCH_DIR = process.env.MAZOS_RESEARCH_DIR || path.join(ROOT, 'research', 'mazos');
export const RUN_DIR = path.join(DATA_DIR, 'runs');
export const INGEST_QUEUE = path.join(DATA_DIR, 'ingest-queue.jsonl');
export const VAULT_INDEX = path.join(DATA_DIR, 'vault-index.json');
export const VAULT_SCAN_MD = path.join(RESEARCH_DIR, 'latest-vault-scan.md');
export const LOOP_RUNS = path.join(DATA_DIR, 'loop-runs.jsonl');
export const LOOP_RECEIPTS = path.join(DATA_DIR, 'loop-receipts.jsonl');
export const LOOPS_STATE = path.join(DATA_DIR, 'loops.json');
export const CUSTOM_LOOPS = path.join(DATA_DIR, 'custom-loops.json');
export const DECISIONS_LOG = path.join(DATA_DIR, 'decisions.jsonl');
export const REMOTE_SNAPSHOT = path.join(DATA_DIR, 'remote-snapshot.json');
export const REMOTE_INTENTS = path.join(DATA_DIR, 'remote-intents.jsonl');

export const OPENWIKI_PATHS = {
  app: 'C:/Users/manaz/AppData/Local/OpenWiki/OpenWiki.exe',
  db: 'C:/Users/manaz/AppData/Roaming/com.openwiki.app/openwiki.db',
  source: 'C:/Users/manaz/Projects/openwiki',
  hermesSource: 'C:/Users/manaz/.hermes/external-sources/openwiki',
  mazosSubmodule: 'C:/Users/manaz/Projects/mazos-ui/external/agent-sources/openwiki',
  starterScript: 'C:/Users/manaz/.hermes/openwiki/start-openwiki.ps1',
  docs: 'docs/OPENWIKI_LOCAL_INSTALL.md',
  mcpServer: 'openwiki',
} as const;

export const HERMES_HOME = 'C:/Users/manaz/AppData/Local/hermes';
export const HERMES_PROFILES_DIR = `${HERMES_HOME}/profiles`;
export const HERMES_ACTIVE_PROFILE_FILE = `${HERMES_HOME}/active_profile`;

export const PATHS = {
  mazos_ui: 'C:/Users/manaz/Projects/mazos-ui',
  recall: 'C:/Users/manaz/Projects/recall',
  jobfilter: 'C:/Users/manaz/JobFilterV1',
  jobfilter_alt: 'C:/Users/manaz/Desktop/JobFilterV1',
  openflowkit: 'C:/Users/manaz/openflowkit',
  openflowkit_alt: 'C:/Users/manaz/Projects/openflowkit',
  obsidian: 'C:/Users/manaz/Desktop/Obsidian Main Vault',
  jobfilter_vault: 'C:/Users/manaz/JobFilter-Obsidian-Vault',
  openwiki_app: OPENWIKI_PATHS.app,
  openwiki_db: OPENWIKI_PATHS.db,
  openwiki_source: OPENWIKI_PATHS.source,
  flowlens: 'C:/Users/manaz/flowlens',
} as const;

export function today() { return new Date().toISOString().slice(0, 10); }
