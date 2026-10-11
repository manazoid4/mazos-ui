import { NextResponse } from 'next/server';
import { listProfiles } from '@/lib/mazos/hermesProfile';
import { inspectHermesScheduledGateway } from '@/lib/mazos/agentDiscovery';

export const dynamic = 'force-dynamic';

type AgentRecord = {
  id: string;
  label: string;
  purpose: string;
  harness: string;
  device: string;
  state: 'configured' | 'profile-detected' | 'unverified' | 'scheduled-running' | 'scheduled-ready';
  evidence: string;
  observedAt: string | null;
  accountSlot?: string;
};

const CLAUDE_ACCOUNTS: AgentRecord[] = [
  { id: 'claude-account-a', label: 'Claude · Account A', purpose: 'Orchestration & builds', harness: 'Claude Code', device: 'Windows workstation', state: 'unverified', evidence: 'User-defined account slot; no login or session inspected', observedAt: null, accountSlot: 'A' },
  { id: 'claude-account-b', label: 'Claude · Account B', purpose: 'Independent review / capacity', harness: 'Claude Code', device: 'Windows workstation', state: 'unverified', evidence: 'User-defined account slot; no login or session inspected', observedAt: null, accountSlot: 'B' },
];

const OTHER: AgentRecord[] = [
  { id: 'codex', label: 'Codex', purpose: 'Coding and verification', harness: 'Codex', device: 'Local CLI / desktop', state: 'configured', evidence: 'mazos-ui/config/agent-runtimes.json — configured, not a heartbeat', observedAt: null },
  { id: 'opencode', label: 'OpenCode', purpose: 'Alternative local reviews', harness: 'OpenCode', device: 'Local CLI', state: 'configured', evidence: 'mazos-ui/config/agent-runtimes.json — configured, not a heartbeat', observedAt: null },
];

function localProfiles(): AgentRecord[] {
  const seen = new Set<string>();
  return listProfiles().filter(p => {
    const key = p.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(profile => {
    const gateway = inspectHermesScheduledGateway(profile.name);
    const name = profile.name;
    const key = name.toLowerCase();
    return {
      id: 'hermes:' + key,
      label: key === 'default' ? 'Hermes · default' : key === 'ilm' ? 'ILM' : key === 'scout' ? 'Scout' : 'Hermes · ' + name,
      purpose: key === 'ilm' ? 'Research, capture and memory' : key === 'scout' ? 'Prospect research and qualification' : profile.description || 'Hermes profile',
      harness: 'Hermes',
      device: 'Local Windows machine',
      state: (gateway.state === 'unknown' ? 'profile-detected' : gateway.state),
      evidence: 'Hermes profile found. ' + gateway.evidence,
      observedAt: gateway.observedAt || new Date().toISOString(),
    };
  });
}

export async function GET() {
  // A cloud preview must never enumerate personal local agents or claim cloud data is machine status.
  if (process.env.VERCEL) {
    return NextResponse.json({
      local: false,
      agents: [...CLAUDE_ACCOUNTS, ...OTHER].map(x => ({ ...x, state: 'unverified', evidence: 'Connect MAZos to a local authenticated runtime', observedAt: null })),
      explanation: 'This public preview has no access to your machine. It does not know which agents are working.',
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const hermesAgents = localProfiles();
  const existing = new Set(hermesAgents.map(a => a.id));
  for (const profile of ['ilm', 'scout']) {
    if (!existing.has('hermes:' + profile)) hermesAgents.push({
      id: 'hermes:' + profile, label: profile === 'ilm' ? 'ILM' : 'Scout',
      purpose: profile === 'ilm' ? 'Research, capture and memory' : 'Prospect research and qualification',
      harness: 'Hermes', device: 'Local Windows machine', state: 'unverified',
      evidence: 'Profile not found in the configured Hermes path. May be installed on another machine.', observedAt: null,
    });
  }
  return NextResponse.json({
    local: true, agents: [...CLAUDE_ACCOUNTS, ...hermesAgents, ...OTHER],
    explanation: 'Profile detection is not the same as a live process heartbeat. Each Claude account is a separate configurable slot.',
  }, { headers: { 'Cache-Control': 'no-store' } });
}
