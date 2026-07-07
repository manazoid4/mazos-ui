// Loop Store: local-first registry of loop/skill packs — the future
// monetisation surface. Packs bundle proven loops + skills for an audience.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DATA_DIR } from './paths';
import { computeTrust } from './trust';

export const LOOP_STORE = path.join(DATA_DIR, 'loop-store.json');

export type PackType = 'loop_pack' | 'skill_pack' | 'research_pack' | 'mcp_pack' | 'prompt_pack';
export type PackAudience = 'solo_builder' | 'indie_hacker' | 'agency' | 'developer' | 'researcher' | 'local_business' | 'job_hunter' | 'founder';
export type PackStatus = 'draft' | 'test_ready' | 'approved' | 'archived';
export type InstallComplexity = 'low' | 'medium' | 'high';

export type Pack = {
  id: string;
  name: string;
  type: PackType;
  audience: PackAudience;
  description: string;
  includedLoopIds: string[];
  includedSkillIds: string[];
  sourceItemIds: string[];
  useCases: string[];
  setupSteps: string[];
  safetyNotes: string[];
  proofReceipts: string[];
  status: PackStatus;
  usefulnessScore: number;
  trustScore: number;
  installComplexity: InstallComplexity;
  createdAt: string;
  updatedAt: string;
};

type Store = { updatedAt: string; packs: Pack[] };

export function readPacks(): Pack[] {
  try {
    if (!fs.existsSync(LOOP_STORE)) return [];
    const parsed = JSON.parse(fs.readFileSync(LOOP_STORE, 'utf8')) as Store;
    return Array.isArray(parsed.packs) ? parsed.packs : [];
  } catch { return []; }
}

export function writePacks(packs: Pack[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(LOOP_STORE, JSON.stringify({ updatedAt: new Date().toISOString(), packs }, null, 2));
}

function idFor(name: string) {
  return `pack_${crypto.createHash('sha1').update(name.toLowerCase()).digest('hex').slice(0, 10)}`;
}

export function buildPack(input: Partial<Pack> & { name: string }, now = new Date().toISOString()): Pack {
  const usefulnessScore = input.usefulnessScore ?? 60;
  const proofReceipts = input.proofReceipts ?? [];
  const trust = computeTrust({
    sourceClarity: true, // packs are assembled locally from known loops/skills
    usefulness: usefulnessScore,
    testable: true,
    hasEvidence: proofReceipts.length > 0,
    safetyRisk: 'low',
    isDuplicate: false,
    setupComplexity: input.installComplexity ?? 'low',
    humanGateRequired: true,
  });
  return {
    id: input.id || idFor(input.name),
    name: input.name,
    type: input.type ?? 'loop_pack',
    audience: input.audience ?? 'founder',
    description: input.description ?? '',
    includedLoopIds: input.includedLoopIds ?? [],
    includedSkillIds: input.includedSkillIds ?? [],
    sourceItemIds: input.sourceItemIds ?? [],
    useCases: input.useCases ?? [],
    setupSteps: input.setupSteps ?? ['Open MAZos WORK tab', 'Load each included loop in the Loop Engineering Deck', 'Run the first loop with its runner prompt'],
    safetyNotes: input.safetyNotes ?? ['All loops start at L1 report-only.', 'No auto-install; every skill is reviewed before use.'],
    proofReceipts,
    status: input.status ?? 'draft',
    usefulnessScore,
    trustScore: trust.trustScore,
    installComplexity: input.installComplexity ?? 'low',
    createdAt: input.createdAt || now,
    updatedAt: now,
  };
}

// Starter packs (idempotent: seed only the missing ones).
export function seedStarterPacks(existing: Pack[]): Pack[] {
  const starters: (Partial<Pack> & { name: string })[] = [
    {
      name: 'Founder Command Pack',
      type: 'loop_pack', audience: 'founder',
      description: 'Turn scattered founder asks into a ranked operating queue with revenue and research radar plus a publishable ship log.',
      includedLoopIds: ['founder-inbox', 'revenue-radar', 'research-intelligence', 'ship-log'],
      useCases: ['Weekly founder triage', 'Deciding what ships next', 'Investor/ship updates'],
    },
    {
      name: 'AI Research Pack',
      type: 'research_pack', audience: 'researcher',
      description: 'AI Source Inbox capture flow plus research-intelligence loop and skill-candidate drafting — scattered links become ranked, sourced moves.',
      includedLoopIds: ['research-intelligence'],
      includedSkillIds: ['ai-source-inbox-flow', 'skill-candidate-drafting'],
      useCases: ['Competitor watch', 'Tool evaluation', 'Instagram AI Feed triage'],
    },
    {
      name: 'Hermes Clean Context Pack',
      type: 'skill_pack', audience: 'developer',
      description: 'Keep agent sessions lean: reap useless features, keep builds green, read latest GitHub before acting, and clean session context.',
      includedLoopIds: ['useless-feature-reaper', 'build-doctor', 'github-pulse'],
      includedSkillIds: ['context-cleanup-prompt'],
      useCases: ['Long-running agent hygiene', 'Repo health', 'Pre-handoff cleanup'],
    },
    {
      name: 'JobFilter Growth Pack',
      type: 'loop_pack', audience: 'indie_hacker',
      description: 'Competitor research, lead-source research, revenue radar, and ship log wired to JobFilter growth.',
      includedLoopIds: ['research-intelligence', 'revenue-radar', 'ship-log'],
      includedSkillIds: ['lead-source-research'],
      useCases: ['JobFilter competitor moves', 'Lead quality', 'Weekly growth update'],
    },
  ];
  const have = new Set(existing.map(p => p.name));
  const added = starters.filter(s => !have.has(s.name)).map(s => buildPack(s));
  return added.length ? [...existing, ...added] : existing;
}

export function packReadme(p: Pack): string {
  const list = (items: string[], empty: string) => (items.length ? items : [empty]).map(x => `- ${x}`).join('\n');
  return [
    `# Pack README`,
    ``,
    `## Name`, p.name,
    ``,
    `## Who it is for`, `${p.audience.replace(/_/g, ' ')} (${p.type.replace(/_/g, ' ')})`,
    ``,
    `## Problem solved`, p.description || 'Describe the problem this pack removes.',
    ``,
    `## Included loops`, list(p.includedLoopIds, 'None yet.'),
    ``,
    `## Included skills`, list(p.includedSkillIds, 'None yet.'),
    ``,
    `## Setup`, list(p.setupSteps, 'Open MAZos and load the pack items.'),
    ``,
    `## How to run`, `Copy each loop's runner prompt from the Loop Engineering Deck and run it in a Hermes/Claude session at the stated safety ceiling.`,
    ``,
    `## Safety limits`, list(p.safetyNotes, 'L1 report-only until proven.'),
    ``,
    `## Proof / receipts`, list(p.proofReceipts, 'No receipts yet — pack stays draft until it earns one.'),
    ``,
    `## Why this is useful`, `usefulness ${p.usefulnessScore}/100 · trust ${p.trustScore}/100 · install ${p.installComplexity} — ${p.useCases.join('; ') || 'define the use cases'}`,
  ].join('\n');
}

export type PackSummary = {
  total: number;
  approved: Pack[];
  drafts: Pack[];
  testReady: Pack[];
  topByUsefulness: Pack[];
  countsByType: Record<string, number>;
  countsByAudience: Record<string, number>;
};

export function buildPackSummary(packs: Pack[]): PackSummary {
  const count = (key: (p: Pack) => string) =>
    packs.reduce<Record<string, number>>((acc, p) => { const k = key(p); acc[k] = (acc[k] || 0) + 1; return acc; }, {});
  return {
    total: packs.length,
    approved: packs.filter(p => p.status === 'approved'),
    drafts: packs.filter(p => p.status === 'draft'),
    testReady: packs.filter(p => p.status === 'test_ready'),
    topByUsefulness: [...packs].sort((a, b) => b.usefulnessScore - a.usefulnessScore).slice(0, 5),
    countsByType: count(p => p.type),
    countsByAudience: count(p => p.audience),
  };
}
