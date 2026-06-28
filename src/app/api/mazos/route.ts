import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';

export async function GET() {
  // Use project path directly since we are building in C:/Users/manaz/Projects/mazos-ui
  const baseDir = path.join(process.cwd(), 'config');

  function readJson(file: string) {
    try { return JSON.parse(fs.readFileSync(path.join(baseDir, file), 'utf8')); } catch {}
    return null;
  }

  function readYaml(file: string) {
    try { return yaml.load(fs.readFileSync(path.join(baseDir, file), 'utf8')); } catch {}
    return null;
  }

  const control = readYaml('control-panel.yaml') as any || {};
  const buttons = readJson('buttons.json') || [];

  return NextResponse.json({
    mission: control?.defaults?.active_mission || 'No mission set',
    priority_repos: control?.defaults?.priority_repos || [],
    toggles: control?.controls || {},
    buttons,
  });
}
