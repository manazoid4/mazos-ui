import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const HERMES_PROFILE = process.env.HERMES_PROFILE_PATH || 'C:/Users/manaz/AppData/Local/hermes/profiles/maz-lite';

export async function GET() {
  const topSkills = [
    { name: 'plan', category: 'software-development', useCount: 0 },
    { name: 'mazos-dashboard', category: 'software-development', useCount: 0 },
    { name: 'github-pr-workflow', category: 'github', useCount: 0 },
    { name: 'firecrawl-scraper', category: 'software-development', useCount: 0 },
    { name: 'financial-model-builder', category: 'productivity', useCount: 0 },
  ];

  const mcpConfigPath = join(HERMES_PROFILE, 'mcp.json');
  let mcpServers: { name: string; connected: boolean; tools: number }[] = [];
  if (existsSync(mcpConfigPath)) {
    try {
      const cfg = JSON.parse(readFileSync(mcpConfigPath, 'utf-8'));
      mcpServers = Object.keys(cfg.servers || {}).map((name) => ({
        name, connected: true, tools: (cfg.servers[name].tools || []).length,
      }));
    } catch { /* parse error */ }
  }

  return NextResponse.json({ topSkills, mcpServers });
}
