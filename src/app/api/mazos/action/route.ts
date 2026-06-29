import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const root = process.env.USERPROFILE || process.env.HOME || 'C:/Users/manaz';

const COMMANDS: Record<string, string> = {
  scan_last_5_sessions: 'echo "Run in Hermes: scan last 5 sessions for unfinished/unpushed/TODO work"',
  improve_recall: 'cd C:/Users/manaz/Projects/recall && npm run lint && npm run build',
  refresh_vault_index: 'cd C:/Users/manaz/MazOS-Agents && powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/obsidian-memory-index.ps1',
  git_unpushed_scan: 'git -C C:/Users/manaz/Projects/mazos-ui status -sb && git -C C:/Users/manaz/Projects/recall status -sb',
  market_research_brief: 'python - <<\'PY\'\nfrom pathlib import Path\np=Path(\'C:/Users/manaz/Desktop/Obsidian Main Vault/Projects/Recall/market-research-brief.md\')\np.parent.mkdir(parents=True, exist_ok=True)\np.write_text(\'# Market research brief\\n\\n- Capture source URLs in Recall.\\n- Tag pain/WTP/audience.\\n- Validate with outbound before building.\\n\', encoding=\'utf-8\')\nprint(p)\nPY',
  email_digest: 'python C:/Users/manaz/AppData/Local/hermes/scripts/send_session_digest.py',
};

function recallCommand(url: string) {
  const endpoint = url.includes('youtu') ? 'youtube' : 'instagram';
  return `python - <<'PY'\nimport json, urllib.request\nurl=${JSON.stringify(url)}\nreq=urllib.request.Request('http://localhost:3029/api/sources/${endpoint}', data=json.dumps({'urls':[url]}).encode(), headers={'Content-Type':'application/json'}, method='POST')\nprint(urllib.request.urlopen(req, timeout=10).read().decode())\nPY`;
}

export async function POST(req: Request) {
  try {
    const { action_type, command_value, danger_level } = await req.json();
    if (danger_level === 'danger') return NextResponse.json({ error: 'Danger commands must be run manually' }, { status: 403 });

    let command = '';
    if (action_type === 'agent_task') command = COMMANDS[String(command_value)] || '';
    if (action_type === 'custom_command') command = String(command_value || '');
    if (action_type === 'recall_ingest') command = recallCommand(String(command_value || ''));
    if (action_type === 'email_digest') command = COMMANDS.email_digest;
    if (action_type === 'scan_vault' || action_type === 'run_safe_prompt') command = String(command_value || '');
    if (!command) return NextResponse.json({ error: `Unsupported action: ${action_type}` }, { status: 400 });
    if (/\brm\s+-rf\b|format\s+[a-z]:|del\s+\/s/i.test(command)) return NextResponse.json({ error: 'Blocked destructive command' }, { status: 403 });

    const { stdout, stderr } = await execAsync(command, { cwd: root, timeout: 120000, maxBuffer: 1024 * 1024 });
    return NextResponse.json({ success: true, output: stdout || stderr || 'OK' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
