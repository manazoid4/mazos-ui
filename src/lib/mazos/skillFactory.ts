// Skill Factory: turn AI Source Inbox items (or raw text) into reusable,
// reviewable skill specs. Deterministic rule-based generation — no external
// API calls, no auto-install, no code execution.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DATA_DIR } from './paths';
import { computeTrust, approvalGaps, buildEvalChecklist, type ApprovalInput } from './trust';
import { matchedKeywords, type SourceItem } from './aiSourceInbox';

export const SKILL_FACTORY = path.join(DATA_DIR, 'skill-factory.json');

export type SkillCategory = 'research' | 'coding' | 'context_management' | 'memory' | 'browser' | 'automation' | 'mcp' | 'prompt' | 'data_ingestion' | 'product' | 'safety' | 'unknown';
export type SkillStatus = 'draft' | 'needs_research' | 'test_ready' | 'approved' | 'rejected' | 'archived';
export type RiskLevel = 'low' | 'medium' | 'high';

export type SkillSpec = {
  id: string;
  name: string;
  sourceItemIds: string[];
  sourceUrls: string[];
  category: SkillCategory;
  whatItDoes: string;
  whenToUse: string;
  inputsNeeded: string[];
  expectedOutput: string;
  requiredTools: string[];
  safetyRisks: string[];
  setupNotes: string;
  testPlan: string[];
  rejectionReasons: string[];
  status: SkillStatus;
  usefulnessScore: number;
  trustScore: number;
  riskLevel: RiskLevel;
  createdAt: string;
  updatedAt: string;
};

type Store = { updatedAt: string; skills: SkillSpec[] };

export function readSkills(): SkillSpec[] {
  try {
    if (!fs.existsSync(SKILL_FACTORY)) return [];
    const parsed = JSON.parse(fs.readFileSync(SKILL_FACTORY, 'utf8')) as Store;
    return Array.isArray(parsed.skills) ? parsed.skills : [];
  } catch { return []; }
}

export function writeSkills(skills: SkillSpec[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SKILL_FACTORY, JSON.stringify({ updatedAt: new Date().toISOString(), skills }, null, 2));
}

export function categorize(text: string): SkillCategory {
  const t = text.toLowerCase();
  if (t.includes('mcp')) return 'mcp';
  if (t.includes('browser') || t.includes('tab') || t.includes('scrape')) return 'browser';
  if (t.includes('memory')) return 'memory';
  if (t.includes('context') || t.includes('session clutter') || t.includes('summaris') || t.includes('summariz')) return 'context_management';
  if (t.includes('prompt')) return 'prompt';
  if (t.includes('ingest') || t.includes('capture') || t.includes('import')) return 'data_ingestion';
  if (t.includes('automat') || t.includes('workflow') || t.includes('recipe')) return 'automation';
  if (t.includes('research') || t.includes('competitor') || t.includes('market')) return 'research';
  if (t.includes('code') || t.includes('repo') || t.includes('build') || t.includes('lint')) return 'coding';
  if (t.includes('safety') || t.includes('guard') || t.includes('permission')) return 'safety';
  if (t.includes('product') || t.includes('pricing') || t.includes('saas')) return 'product';
  return 'unknown';
}

function riskFor(category: SkillCategory, text: string): RiskLevel {
  const t = text.toLowerCase();
  if (t.includes('credential') || t.includes('login') || t.includes('password') || t.includes('destructive')) return 'high';
  if (category === 'browser' || category === 'automation' || category === 'mcp') return 'medium';
  return 'low';
}

function idFor(seed: string) {
  return `skl_${crypto.createHash('sha1').update(seed).digest('hex').slice(0, 10)}`;
}

function nameFrom(text: string): string {
  const clean = text.trim().split(/\s+/).slice(0, 8).join(' ').replace(/https?:\/\/\S+/g, '').trim() || 'Unnamed skill';
  return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean;
}

// Deterministic spec generation from a source item or raw text.
export function generateSkillSpec(input: { sourceItem?: SourceItem; rawText?: string }, now = new Date().toISOString()): SkillSpec {
  const text = input.sourceItem ? `${input.sourceItem.title}\n${input.sourceItem.rawInput}\n${input.sourceItem.notes}` : (input.rawText || '');
  const category = categorize(text);
  const risk = riskFor(category, text);
  const kw = matchedKeywords(text);
  const usefulnessScore = input.sourceItem ? input.sourceItem.usefulnessScore : Math.min(100, 30 + kw.length * 8);
  const url = input.sourceItem?.url || '';
  const trust = computeTrust({
    sourceClarity: !!url || text.trim().length > 40,
    usefulness: usefulnessScore,
    testable: true, // every spec ships with a test plan
    hasEvidence: false,
    safetyRisk: risk,
    isDuplicate: false,
    setupComplexity: category === 'mcp' || category === 'browser' ? 'medium' : 'low',
    humanGateRequired: true,
  });

  return {
    id: idFor(`${url}|${text.slice(0, 200)}`),
    name: nameFrom(input.sourceItem?.title || text),
    sourceItemIds: input.sourceItem ? [input.sourceItem.id] : [],
    sourceUrls: url ? [url] : [],
    category,
    whatItDoes: `Reusable ${category.replace(/_/g, ' ')} capability distilled from: ${text.trim().split('\n')[0].slice(0, 160)}`,
    whenToUse: category === 'research' ? 'When MAZos needs bounded market/competitor evidence before a product move.'
      : category === 'context_management' ? 'When agent sessions accumulate clutter and only load-bearing context should survive.'
      : category === 'mcp' ? 'When an agent needs this capability exposed as a local MCP tool.'
      : 'When the same manual step has been repeated twice — third time runs through this skill.',
    inputsNeeded: [url ? `Source: ${url}` : 'Source text or file path', 'Target project or repo', 'Safety ceiling (L1-L3)'],
    expectedOutput: 'A verifiable artefact: report, prompt output, file change, or receipt — quoted, not asserted.',
    requiredTools: category === 'browser' ? ['Local browser automation (reviewed)'] : category === 'mcp' ? ['Local MCP server (reviewed before install)'] : ['Claude Code / Hermes session'],
    safetyRisks: [
      risk === 'high' ? 'Touches credentials or destructive surface — human gate mandatory.' : 'Low direct risk; keep read-only until tested.',
      'Never auto-install or execute fetched code; review source first.',
    ],
    setupNotes: url ? `Read ${url} first. Do not clone/run until reviewed.` : 'Local-only: no setup beyond MAZos.',
    testPlan: [
      'Run once on a real but low-stakes input.',
      'Quote the exact output as evidence.',
      'Confirm nothing outside scope was touched.',
    ],
    rejectionReasons: [],
    status: 'draft',
    usefulnessScore,
    trustScore: trust.trustScore,
    riskLevel: risk,
    createdAt: now,
    updatedAt: now,
  };
}

// Approval floor from the trust layer, applied at PATCH time.
export function approvalBlockers(a: ApprovalInput): string[] {
  return approvalGaps(a);
}

export function skillSpecMarkdown(s: SkillSpec): string {
  return [
    `# Skill Spec`,
    ``,
    `## Name`, s.name,
    ``,
    `## Source`, ...(s.sourceUrls.length ? s.sourceUrls.map(u => `- ${u}`) : ['- Local note (no URL)']),
    ``,
    `## Category`, s.category,
    ``,
    `## What it does`, s.whatItDoes,
    ``,
    `## When MAZos should use it`, s.whenToUse,
    ``,
    `## Inputs needed`, ...s.inputsNeeded.map(i => `- ${i}`),
    ``,
    `## Expected output`, s.expectedOutput,
    ``,
    `## Required tools`, ...s.requiredTools.map(t => `- ${t}`),
    ``,
    `## Safety / limits`, ...s.safetyRisks.map(r => `- ${r}`),
    ``,
    `## Test plan`, ...s.testPlan.map(t => `- ${t}`),
    ``,
    `## Keep / reject decision`,
    `- usefulness ${s.usefulnessScore}/100 · trust ${s.trustScore}/100 · risk ${s.riskLevel} · status ${s.status}`,
    s.rejectionReasons.length ? `- rejected because: ${s.rejectionReasons.join('; ')}` : `- pending human decision`,
  ].join('\n');
}

export function skillEvalChecklist(s: SkillSpec): string {
  return buildEvalChecklist({
    name: s.name,
    expectations: [s.whatItDoes, s.expectedOutput],
    antiExpectations: s.safetyRisks,
    inputs: s.inputsNeeded,
    expectedOutput: s.expectedOutput,
    safetyChecks: ['No auto-install', 'No unreviewed code execution', `Risk level ${s.riskLevel} accepted by human`],
    evidence: [`Test plan output for: ${s.testPlan[0] || 'first run'}`],
  });
}

export type SkillSummary = {
  total: number;
  countsByStatus: Record<string, number>;
  topCandidates: SkillSpec[];
  rejectedCount: number;
  archivedCount: number;
};

export function buildSkillSummary(skills: SkillSpec[]): SkillSummary {
  const countsByStatus = skills.reduce<Record<string, number>>((acc, s) => { acc[s.status] = (acc[s.status] || 0) + 1; return acc; }, {});
  return {
    total: skills.length,
    countsByStatus,
    topCandidates: [...skills].filter(s => s.status === 'draft' || s.status === 'test_ready').sort((a, b) => b.usefulnessScore - a.usefulnessScore).slice(0, 5),
    rejectedCount: countsByStatus['rejected'] || 0,
    archivedCount: countsByStatus['archived'] || 0,
  };
}
