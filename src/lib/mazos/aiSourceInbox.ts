// AI Source Inbox: paste messy AI links/notes → classified, scored, deduped
// items that must end in a decision (skill, loop, research, competitor,
// product idea, archive, or ignore). Local-first; nothing is ever fetched.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DATA_DIR } from './paths';
import { computeTrust, type TrustResult } from './trust';

export const AI_SOURCE_INBOX = path.join(DATA_DIR, 'ai-source-inbox.json');

export type SourcePlatform = 'github' | 'instagram' | 'youtube' | 'x' | 'website' | 'docs' | 'local_note' | 'unknown';
export type SourceType = 'repo' | 'issue' | 'pull_request' | 'file' | 'ai_tool' | 'skill' | 'prompt' | 'mcp_server' | 'workflow' | 'tutorial' | 'competitor' | 'product_idea' | 'research_note' | 'unknown';
export type SourceStatus = 'new' | 'research' | 'skill_candidate' | 'loop_candidate' | 'competitor' | 'product_idea' | 'archived' | 'ignored';
export type SuggestedAction = 'research' | 'make_skill' | 'add_to_loop_factory' | 'add_to_competitor_radar' | 'save_for_later' | 'ignore';

export type SourceItem = {
  id: string;
  rawInput: string;
  url: string;
  sourcePlatform: SourcePlatform;
  sourceType: SourceType;
  title: string;
  summary: string;
  notes: string;
  tags: string[];
  status: SourceStatus;
  usefulnessScore: number;
  trustScore: number;
  suggestedAction: SuggestedAction;
  createdAt: string;
  updatedAt: string;
};

export const KEYWORDS = ['mcp', 'skill', 'prompt', 'agent', 'workflow', 'automation', 'browser', 'memory', 'context', 'dashboard', 'ai tool', 'open source', 'template', 'api'] as const;

const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;

export function extractUrls(text: string): string[] {
  return Array.from(new Set((text.match(URL_RE) || []).map(u => u.replace(/[.,;]+$/, ''))));
}

export function normalizeUrl(url: string): string {
  return url.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '').split(/[?#]/)[0];
}

export function detectPlatform(url: string, raw: string): SourcePlatform {
  if (!url) return raw.trim() ? 'local_note' : 'unknown';
  const u = url.toLowerCase();
  if (u.includes('github.com')) return 'github';
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('twitter.com') || /\/\/(www\.)?x\.com\//.test(u)) return 'x';
  if (/docs?\.|\/docs\b|readthedocs|documentation/.test(u)) return 'docs';
  return 'website';
}

export function detectSourceType(platform: SourcePlatform, url: string, text: string): SourceType {
  const t = text.toLowerCase();
  if (platform === 'github') {
    if (/\/issues\//.test(url)) return 'issue';
    if (/\/pull\//.test(url)) return 'pull_request';
    if (/\/blob\//.test(url)) return 'file';
    return 'repo';
  }
  if (t.includes('mcp')) return 'mcp_server';
  if (t.includes('prompt')) return 'prompt';
  if (t.includes('skill')) return 'skill';
  if (t.includes('workflow') || t.includes('automation')) return 'workflow';
  if (t.includes('tutorial') || t.includes('how to') || t.includes('guide')) return 'tutorial';
  if (t.includes('competitor') || t.includes(' vs ') || t.includes('alternative')) return 'competitor';
  if (t.includes('product idea') || t.includes('idea:') || t.includes('build a')) return 'product_idea';
  if (t.includes('research') || t.includes('paper')) return 'research_note';
  // Instagram AI Feed saves are usually tool demos or tutorials.
  if (platform === 'instagram') return t.includes('tool') || t.includes('app') ? 'ai_tool' : 'unknown';
  if (platform === 'youtube') return 'tutorial';
  if (t.includes('ai tool') || t.includes('tool') || t.includes('app')) return 'ai_tool';
  if (platform === 'docs') return 'tutorial';
  return platform === 'local_note' ? 'research_note' : 'unknown';
}

export function matchedKeywords(text: string): string[] {
  const t = text.toLowerCase();
  return KEYWORDS.filter(k => t.includes(k));
}

export function scoreUsefulness(item: Pick<SourceItem, 'sourcePlatform' | 'sourceType' | 'rawInput' | 'url'>): number {
  const kw = matchedKeywords(item.rawInput);
  let score = 20;
  score += Math.min(30, kw.length * 6);
  const platformWeight: Record<SourcePlatform, number> = { github: 20, docs: 15, website: 10, youtube: 8, x: 6, instagram: 6, local_note: 8, unknown: 0 };
  score += platformWeight[item.sourcePlatform];
  const typeWeight: Partial<Record<SourceType, number>> = { mcp_server: 15, skill: 15, workflow: 12, prompt: 10, repo: 10, ai_tool: 10, tutorial: 6, product_idea: 8, competitor: 8, research_note: 5 };
  score += typeWeight[item.sourceType] || 0;
  if (item.url) score += 5;
  if (item.rawInput.trim().length > 120) score += 5; // real notes beat bare links
  return Math.max(0, Math.min(100, score));
}

export function suggestAction(item: Pick<SourceItem, 'sourceType' | 'usefulnessScore' | 'sourcePlatform'>): SuggestedAction {
  if (item.usefulnessScore < 25) return 'ignore';
  if (item.sourceType === 'competitor') return 'add_to_competitor_radar';
  if (item.sourceType === 'skill' || item.sourceType === 'prompt' || item.sourceType === 'mcp_server') return 'make_skill';
  if (item.sourceType === 'workflow' || item.sourceType === 'repo') return 'add_to_loop_factory';
  if (item.usefulnessScore >= 60) return 'research';
  return 'save_for_later';
}

export function trustFor(item: Pick<SourceItem, 'url' | 'usefulnessScore' | 'sourcePlatform' | 'sourceType' | 'rawInput'>, isDupe = false): TrustResult {
  return computeTrust({
    sourceClarity: !!item.url || item.rawInput.trim().length > 40,
    usefulness: item.usefulnessScore,
    testable: item.sourcePlatform === 'github' || item.sourcePlatform === 'docs' || item.sourceType === 'prompt' || item.sourceType === 'workflow',
    hasEvidence: false, // fresh paste has no receipts yet
    safetyRisk: item.sourcePlatform === 'instagram' || item.sourcePlatform === 'x' || item.sourcePlatform === 'unknown' ? 'medium' : 'low',
    isDuplicate: isDupe,
    setupComplexity: item.sourceType === 'mcp_server' ? 'medium' : 'low',
    humanGateRequired: true,
  });
}

// Loop-pattern map for "Add to Loop" (used by the UI and tests).
export function suggestLoopPattern(item: Pick<SourceItem, 'sourcePlatform' | 'sourceType' | 'rawInput'>): string {
  const t = item.rawInput.toLowerCase();
  if (/pricing|saas|funnel|revenue|conversion/.test(t)) return 'revenue-radar';
  if (/build|lint|\bci\b|dev tool|tooling|compile/.test(t)) return 'build-doctor';
  if (item.sourceType === 'competitor' || /competitor|market research/.test(t)) return 'research-intelligence';
  if (item.sourcePlatform === 'github' && item.sourceType === 'repo') return 'github-pulse';
  if (/weak|low.value|useless|bloat/.test(t)) return 'useless-feature-reaper';
  if (item.sourceType === 'workflow' || /repeat|every (day|week)|recurring/.test(t)) return 'intake-drainer';
  return 'founder-inbox'; // messy saved posts / scattered ideas
}

type Store = { updatedAt: string; items: SourceItem[] };

export function readInbox(): SourceItem[] {
  try {
    if (!fs.existsSync(AI_SOURCE_INBOX)) return [];
    const parsed = JSON.parse(fs.readFileSync(AI_SOURCE_INBOX, 'utf8')) as Store;
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch { return []; }
}

export function writeInbox(items: SourceItem[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(AI_SOURCE_INBOX, JSON.stringify({ updatedAt: new Date().toISOString(), items }, null, 2));
}

function idFor(seed: string) {
  return `src_${crypto.createHash('sha1').update(seed).digest('hex').slice(0, 10)}`;
}

function titleFor(url: string, raw: string): string {
  if (url) {
    const clean = normalizeUrl(url);
    return clean.length > 70 ? `${clean.slice(0, 67)}…` : clean;
  }
  const line = raw.trim().split('\n')[0];
  return line.length > 70 ? `${line.slice(0, 67)}…` : line || 'Untitled note';
}

export function isDuplicate(candidate: { url: string; rawInput: string }, existing: SourceItem[]): boolean {
  if (candidate.url) {
    const norm = normalizeUrl(candidate.url);
    return existing.some(i => i.url && normalizeUrl(i.url) === norm);
  }
  const norm = candidate.rawInput.trim().toLowerCase();
  return existing.some(i => i.rawInput.trim().toLowerCase() === norm);
}

export function buildItem(rawInput: string, url: string, existing: SourceItem[], now = new Date().toISOString()): SourceItem {
  const sourcePlatform = detectPlatform(url, rawInput);
  const sourceType = detectSourceType(sourcePlatform, url, rawInput);
  const partial = { rawInput, url, sourcePlatform, sourceType };
  const usefulnessScore = scoreUsefulness(partial);
  const trust = trustFor({ ...partial, usefulnessScore }, isDuplicate({ url, rawInput }, existing));
  return {
    id: idFor(url ? normalizeUrl(url) : rawInput.trim().toLowerCase()),
    rawInput,
    url,
    sourcePlatform,
    sourceType,
    title: titleFor(url, rawInput),
    summary: rawInput.trim().split('\n').filter(Boolean).slice(0, 2).join(' ').slice(0, 200) || url,
    notes: '',
    tags: matchedKeywords(rawInput),
    status: 'new',
    usefulnessScore,
    trustScore: trust.trustScore,
    suggestedAction: suggestAction({ sourceType, usefulnessScore, sourcePlatform }),
    createdAt: now,
    updatedAt: now,
  };
}

// Parse a messy paste into new items: one item per URL (with its surrounding
// line as context) plus one local_note item covering the URL-less lines.
export function parsePaste(raw: string, existing: SourceItem[]): { added: SourceItem[]; skippedDuplicates: number } {
  const added: SourceItem[] = [];
  let skippedDuplicates = 0;
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const noteLines: string[] = [];

  const pool = [...existing];
  for (const line of lines) {
    const urls = extractUrls(line);
    if (urls.length === 0) { noteLines.push(line); continue; }
    for (const url of urls) {
      if (isDuplicate({ url, rawInput: line }, pool)) { skippedDuplicates += 1; continue; }
      const item = buildItem(line, url, pool);
      added.push(item); pool.push(item);
    }
  }
  if (noteLines.length) {
    const noteText = noteLines.join('\n');
    if (isDuplicate({ url: '', rawInput: noteText }, pool)) skippedDuplicates += 1;
    else { const item = buildItem(noteText, '', pool); added.push(item); pool.push(item); }
  }
  return { added, skippedDuplicates };
}

export type InboxSummary = {
  total: number;
  countsByStatus: Record<string, number>;
  countsByPlatform: Record<string, number>;
  latest: SourceItem[];
  topByUsefulness: SourceItem[];
  topSkillCandidate: SourceItem | null;
  topLoopCandidate: SourceItem | null;
  recommendedNextAction: string;
};

export function buildSummary(items: SourceItem[]): InboxSummary {
  const live = items.filter(i => i.status !== 'archived' && i.status !== 'ignored');
  const count = (key: (i: SourceItem) => string) =>
    items.reduce<Record<string, number>>((acc, i) => { const k = key(i); acc[k] = (acc[k] || 0) + 1; return acc; }, {});
  const byScore = [...live].sort((a, b) => b.usefulnessScore - a.usefulnessScore);
  const topSkillCandidate = byScore.find(i => i.suggestedAction === 'make_skill' || i.status === 'skill_candidate') || null;
  const topLoopCandidate = byScore.find(i => i.suggestedAction === 'add_to_loop_factory' || i.status === 'loop_candidate') || null;
  const newCount = live.filter(i => i.status === 'new').length;
  const recommendedNextAction =
    topSkillCandidate ? `Draft a skill from "${topSkillCandidate.title}" (usefulness ${topSkillCandidate.usefulnessScore}).`
    : topLoopCandidate ? `Send "${topLoopCandidate.title}" to the Loop Factory.`
    : newCount > 0 ? `Triage ${newCount} new source(s): decide skill, loop, research, or ignore.`
    : 'Inbox clear — paste new AI sources or move on to the Shipping Spine.';
  return {
    total: items.length,
    countsByStatus: count(i => i.status),
    countsByPlatform: count(i => i.sourcePlatform),
    latest: [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10),
    topByUsefulness: byScore.slice(0, 10),
    topSkillCandidate,
    topLoopCandidate,
    recommendedNextAction,
  };
}
