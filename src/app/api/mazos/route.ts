import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';

export async function GET() {
  const hermesBase = path.join(process.env.USERPROFILE || process.env.HOME || '', 'AppData', 'Local', 'hermes', 'hermes-agent', 'profiles', 'default', 'mazos');
  const fallback = path.join(process.env.USERPROFILE || process.env.HOME || '', '.hermes', 'mazos');

  function readJson(file: string) {
    for (const base of [hermesBase, fallback]) {
      try { return JSON.parse(fs.readFileSync(path.join(base, file), 'utf8')); } catch {}
    }
    return null;
  }

  function readYaml(file: string) {
    for (const base of [hermesBase, fallback]) {
      try { return yaml.load(fs.readFileSync(path.join(base, file), 'utf8')); } catch {}
    }
    return null;
  }

  const control = readYaml('control-panel.yaml') as any || {};
  const buttons = readJson('buttons.json') || [];

  return NextResponse.json({
    mission: control?.defaults?.active_mission || 'No mission set',
    priority_repos: control?.defaults?.priority_repos || [],
    toggles: control?.toggles || {},
    buttons,
  });
}
