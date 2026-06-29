import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';

const last = (p: string) => {
  try { return fs.statSync(p).mtime.toISOString().slice(0, 16).replace('T', ' '); } catch { return 'never'; }
};

export async function GET() {
  const baseDir = path.join(process.cwd(), 'config');
  const hermes = path.join(process.env.LOCALAPPDATA || 'C:/Users/manaz/AppData/Local', 'hermes');
  const vault = 'C:/Users/manaz/Desktop/Obsidian Main Vault';

  function readJson(file: string) { try { return JSON.parse(fs.readFileSync(path.join(baseDir, file), 'utf8')); } catch { return null; } }
  function readYaml(file: string) { try { return yaml.load(fs.readFileSync(path.join(baseDir, file), 'utf8')); } catch { return null; } }
  function names(dir: string, kind: string) {
    try { return fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).slice(0, 12).map(d => ({ name: d.name, kind, enabled: true, last_used: last(path.join(dir, d.name)) })); } catch { return []; }
  }

  const control = readYaml('control-panel.yaml') as any || {};
  const buttons = readJson('buttons.json') || [];
  const plugins = [...names(path.join(hermes, 'skills'), 'skill'), ...names(path.join(hermes, 'plugins'), 'plugin')];
  const sessions = [
    { id: 'current', title: 'Current TUI Session', source: 'hermes', last_active: new Date().toISOString().slice(0, 16).replace('T', ' ') },
    { id: 'recall', title: 'Recall ingest work', source: 'next', last_active: last('C:/Users/manaz/Projects/recall') },
    { id: 'mazos-ui', title: 'MazOS dashboard', source: 'next', last_active: last(process.cwd()) },
  ];

  return NextResponse.json({
    mission: control?.defaults?.active_mission || 'No mission set',
    priority_repos: control?.defaults?.priority_repos || [],
    toggles: control?.controls || {},
    buttons,
    plugins,
    sessions,
    vault,
  });
}
