import { execFileSync, spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { OPENWIKI_PATHS, ROOT } from './paths';

export type OpenWikiLatestPage = {
  id: string;
  title: string;
  updatedAt: string | null;
};

export type OpenWikiStatus = {
  generatedAt: string;
  paths: typeof OPENWIKI_PATHS;
  installed: boolean;
  databaseExists: boolean;
  sourceExists: boolean;
  hermesSourceExists: boolean;
  mazosSubmoduleExists: boolean;
  starterScriptExists: boolean;
  process: {
    running: boolean;
    id: string | null;
    startTime: string | null;
    path: string | null;
  };
  scheduledTask: {
    exists: boolean;
    state: string | null;
    taskName: string;
  };
  counts: {
    wikiPages: number;
    capturedContent: number;
    weeklyReports: number;
    reportSections: number;
    attentionInsights: number;
  };
  latestPages: OpenWikiLatestPage[];
  healthScore: number;
  healthSignals: string[];
  knowledgeGaps: string[];
  mcp: {
    serverName: string;
    reminder: string;
    configSnippet: string;
  };
  safety: {
    allowShell: boolean;
    mode: string;
    reminder: string;
  };
  prompts: {
    agentContext: string;
    launchCommand: string;
    mcpReminder: string;
  };
};

const TASK_NAME = 'OpenWiki Local Knowledge App';

function toWinPath(value: string) {
  return value.replace(/\//g, '\\');
}

function shellAllowed() {
  try {
    const config = readFileSync(path.join(ROOT, 'config', 'control-panel.yaml'), 'utf8');
    return /^\s*allow_shell:\s*true\s*$/m.test(config);
  } catch {
    return false;
  }
}

function readProcess() {
  try {
    const output = execFileSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      "Get-Process openwiki -ErrorAction SilentlyContinue | Select-Object -First 1 ProcessName,Id,StartTime,Path | ConvertTo-Json -Compress",
    ], { encoding: 'utf8', timeout: 4000 }).trim();
    if (!output) return { running: false, id: null, startTime: null, path: null };
    const parsed = JSON.parse(output);
    return {
      running: true,
      id: parsed.Id ? String(parsed.Id) : null,
      startTime: parsed.StartTime || null,
      path: parsed.Path || null,
    };
  } catch {
    return { running: false, id: null, startTime: null, path: null };
  }
}

function readScheduledTask() {
  try {
    const output = execFileSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `$task = Get-ScheduledTask -TaskName "${TASK_NAME}" -ErrorAction SilentlyContinue | Select-Object -First 1; if ($task) { [pscustomobject]@{ TaskName = $task.TaskName; State = $task.State.ToString() } | ConvertTo-Json -Compress }`,
    ], { encoding: 'utf8', timeout: 4000 }).trim();
    if (!output) return { exists: false, state: null, taskName: TASK_NAME };
    const parsed = JSON.parse(output);
    return { exists: true, state: parsed.State || null, taskName: TASK_NAME };
  } catch {
    return { exists: false, state: null, taskName: TASK_NAME };
  }
}

function readDatabase() {
  const empty = {
    counts: { wikiPages: 0, capturedContent: 0, weeklyReports: 0, reportSections: 0, attentionInsights: 0 },
    latestPages: [] as OpenWikiLatestPage[],
  };
  if (!existsSync(OPENWIKI_PATHS.db)) return empty;

  const script = `
import json, sqlite3, sys
db = sys.argv[1]
result = {
  "counts": {"wikiPages": 0, "capturedContent": 0, "weeklyReports": 0, "reportSections": 0, "attentionInsights": 0},
  "latestPages": []
}
con = sqlite3.connect("file:" + db + "?mode=ro", uri=True)
cur = con.cursor()
table_map = {
  "wikiPages": "wiki_pages",
  "capturedContent": "captured_content",
  "weeklyReports": "weekly_reports",
  "reportSections": "report_sections",
  "attentionInsights": "attention_insights"
}
tables = {row[0] for row in cur.execute("select name from sqlite_master where type='table'")}
for key, table in table_map.items():
  if table in tables:
    result["counts"][key] = cur.execute(f'select count(*) from "{table}"').fetchone()[0]
if "wiki_pages" in tables:
  cols = [row[1] for row in cur.execute('pragma table_info("wiki_pages")')]
  id_col = "id" if "id" in cols else "rowid"
  title_col = "title" if "title" in cols else ("name" if "name" in cols else None)
  updated_col = next((c for c in ["updated_at", "last_updated", "created_at"] if c in cols), None)
  select_title = title_col if title_col else "'Untitled page'"
  select_updated = updated_col if updated_col else "NULL"
  order_col = updated_col if updated_col else id_col
  rows = cur.execute(f'select {id_col}, {select_title}, {select_updated} from "wiki_pages" order by {order_col} desc limit 6').fetchall()
  result["latestPages"] = [{"id": str(r[0]), "title": str(r[1] or "Untitled page"), "updatedAt": r[2]} for r in rows]
print(json.dumps(result))
`;

  for (const command of ['python.exe', 'py.exe']) {
    const result = spawnSync(command, ['-c', script, toWinPath(OPENWIKI_PATHS.db)], {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    });
    if (result.status === 0 && result.stdout.trim()) {
      try {
        return JSON.parse(result.stdout);
      } catch {
        return empty;
      }
    }
  }
  return empty;
}

function buildLaunchCommand() {
  return `powershell -NoProfile -ExecutionPolicy Bypass -File "${toWinPath(OPENWIKI_PATHS.starterScript)}"`;
}

function buildMcpReminder() {
  return `Use MCP server "openwiki" for read-only SQLite queries against ${toWinPath(OPENWIKI_PATHS.db)}. Prefer OpenWiki Markdown export for Obsidian handoffs. Do not mutate the database unless Maz explicitly asks.`;
}

function buildAgentContext(status: Pick<OpenWikiStatus, 'counts' | 'latestPages' | 'healthScore' | 'knowledgeGaps'>) {
  const pages = status.latestPages.map(p => `- ${p.title}${p.updatedAt ? ` (${p.updatedAt})` : ''}`).join('\n') || '- No pages found.';
  const gaps = status.knowledgeGaps.map(g => `- ${g}`).join('\n') || '- No urgent gaps.';
  return `You are working on MAZos with OpenWiki available as a local-first knowledge source.

OpenWiki facts:
- App: ${toWinPath(OPENWIKI_PATHS.app)}
- DB: ${toWinPath(OPENWIKI_PATHS.db)}
- Source: ${toWinPath(OPENWIKI_PATHS.source)}
- Hermes source: ${toWinPath(OPENWIKI_PATHS.hermesSource)}
- MCP server: openwiki
- Current health score: ${status.healthScore}/100
- Wiki pages: ${status.counts.wikiPages}
- Captured content: ${status.counts.capturedContent}
- Weekly reports: ${status.counts.weeklyReports}

Latest pages:
${pages}

Knowledge gaps:
${gaps}

Rules:
- Treat MAZos as the cockpit and OpenWiki as the local capture/wiki source.
- Query OpenWiki read-only through MCP or SQLite unless Maz explicitly asks for mutation.
- Prefer exported Markdown for Obsidian handoff.
- When improving MAZos, make OpenWiki more useful for agent memory, project context, session handoff, and market-breaking personal AI workflows.`;
}

export function getOpenWikiStatus(): OpenWikiStatus {
  const db = readDatabase();
  const process = readProcess();
  const scheduledTask = readScheduledTask();
  const installed = existsSync(OPENWIKI_PATHS.app);
  const databaseExists = existsSync(OPENWIKI_PATHS.db);
  const sourceExists = existsSync(OPENWIKI_PATHS.source);
  const hermesSourceExists = existsSync(OPENWIKI_PATHS.hermesSource);
  const mazosSubmoduleExists = existsSync(OPENWIKI_PATHS.mazosSubmodule);
  const starterScriptExists = existsSync(OPENWIKI_PATHS.starterScript);
  const healthSignals: string[] = [];

  let healthScore = 0;
  if (installed) { healthScore += 15; healthSignals.push('OpenWiki app installed.'); }
  if (databaseExists) { healthScore += 15; healthSignals.push('SQLite database available.'); }
  if (process.running) { healthScore += 15; healthSignals.push('OpenWiki process running.'); }
  if (scheduledTask.exists) { healthScore += 10; healthSignals.push(`Windows logon task is ${scheduledTask.state || 'configured'}.`); }
  if (sourceExists) { healthScore += 10; healthSignals.push('Source clone available.'); }
  if (hermesSourceExists) { healthScore += 10; healthSignals.push('Hermes source mirror available.'); }
  if (mazosSubmoduleExists) { healthScore += 10; healthSignals.push('MAZos submodule pointer available.'); }
  if (db.counts.wikiPages > 0) { healthScore += 10; healthSignals.push(`${db.counts.wikiPages} wiki page(s) seeded.`); }
  if (db.counts.capturedContent > 0) { healthScore += 3; healthSignals.push(`${db.counts.capturedContent} captured item(s).`); }
  if (db.counts.weeklyReports > 0) { healthScore += 2; healthSignals.push(`${db.counts.weeklyReports} weekly report(s).`); }

  const knowledgeGaps = [
    !process.running ? 'OpenWiki is not running; start it before relying on live capture.' : '',
    db.counts.capturedContent === 0 ? 'No captured content yet; seed high-value MAZos, Recall, JobFilter, and agent-session context.' : '',
    db.counts.weeklyReports === 0 ? 'No weekly reports yet; configure OpenWiki AI provider if in-app reports matter.' : '',
    db.counts.wikiPages < 6 ? 'Only a small wiki seed exists; add project pages for MAZos, Recall, JobFilter, OpenFlowKit, and Hermes.' : '',
  ].filter(Boolean);

  const allowShell = shellAllowed();
  const shellMode = allowShell ? 'shell-enabled' : 'prompt-only';
  const statusForPrompt = { counts: db.counts, latestPages: db.latestPages, healthScore, knowledgeGaps };
  const launchCommand = buildLaunchCommand();
  const mcpReminder = buildMcpReminder();

  return {
    generatedAt: new Date().toISOString(),
    paths: OPENWIKI_PATHS,
    installed,
    databaseExists,
    sourceExists,
    hermesSourceExists,
    mazosSubmoduleExists,
    starterScriptExists,
    process,
    scheduledTask,
    counts: db.counts,
    latestPages: db.latestPages,
    healthScore: Math.min(100, healthScore),
    healthSignals,
    knowledgeGaps,
    mcp: {
      serverName: OPENWIKI_PATHS.mcpServer,
      reminder: mcpReminder,
      configSnippet: JSON.stringify({
        command: 'C:\\Program Files\\nodejs\\npx.cmd',
        args: ['-y', 'mcp-server-sqlite-npx', toWinPath(OPENWIKI_PATHS.db)],
      }, null, 2),
    },
    safety: {
      allowShell,
      mode: shellMode,
      reminder: allowShell
        ? 'Shell is enabled in MAZos config; still prefer explicit user-triggered actions.'
        : 'Shell is disabled in MAZos config, so OpenWiki actions return prompts/commands only.',
    },
    prompts: {
      agentContext: buildAgentContext(statusForPrompt),
      launchCommand,
      mcpReminder,
    },
  };
}

export function buildOpenWikiAction(action: string) {
  const status = getOpenWikiStatus();
  if (action === 'agent-context') {
    return { action, ok: true, text: status.prompts.agentContext, status };
  }
  if (action === 'launch-prompt') {
    return {
      action,
      ok: true,
      text: status.prompts.launchCommand,
      shellExecuted: false,
      reason: status.safety.allowShell
        ? 'MAZos still returns a launch command for deliberate user execution.'
        : 'config/control-panel.yaml has allow_shell: false.',
      status,
    };
  }
  if (action === 'mcp-reminder') {
    return { action, ok: true, text: status.prompts.mcpReminder, status };
  }
  return { action, ok: false, error: 'Unknown OpenWiki action.', status };
}
