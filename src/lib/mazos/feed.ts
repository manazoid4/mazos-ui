import fs from 'fs';
import crypto from 'crypto';
import { DECISIONS_LOG, INGEST_QUEUE } from './paths';
import { foldDecisions, type DecisionEvent } from './decisions';
import { readRuns } from './logStore';
import { buildShipLog } from './shipLog';
import { buildShippingSpine } from './shippingSpine';
import { scanRepos } from './repoScanner';
import { computeStaleFindings } from './staleRadar';
import { getOpenWikiStatus } from './openWiki';
import type { SafetyLevel } from './safety';

export type FeedItemType =
  | 'decision'
  | 'shipping-spine'
  | 'run'
  | 'stale-work'
  | 'ship-log'
  | 'intake'
  | 'openwiki'
  | 'system';

export type FeedItem = {
  id: string;
  createdAt: string;
  updatedAt?: string;
  type: FeedItemType;
  source: string;
  product?: string;
  title: string;
  summary: string;
  whyItMatters: string;
  nextAction: string;
  evidence: string[];
  evidencePaths: string[];
  safety: SafetyLevel;
  score: number;
  requiresAttention: boolean;
  status: 'new' | 'active' | 'resolved' | 'muted';
  href?: string;
  copyPrompt?: string;
};

export type FeedResponse = {
  generatedAt: string;
  mode: 'local' | 'hosted-fallback';
  verdict: {
    changedWhatShipsNext: boolean;
    headline: string;
    nextAction: string;
    topItemId: string | null;
  };
  filters: {
    products: string[];
    types: FeedItemType[];
    attentionCount: number;
  };
  items: FeedItem[];
  degraded: boolean;
  warnings: string[];
};

type BuildFeedOptions = {
  limit?: number;
  product?: string;
  type?: FeedItemType;
  attentionOnly?: boolean;
};

const TYPE_BASE: Record<FeedItemType, number> = {
  decision: 95,
  'shipping-spine': 90,
  run: 70,
  'stale-work': 75,
  'ship-log': 65,
  intake: 55,
  openwiki: 45,
  system: 30,
};

function idFor(...parts: string[]) {
  return crypto.createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 12);
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function ageBoost(iso: string) {
  const ageHours = (Date.now() - new Date(iso).getTime()) / 36e5;
  if (!Number.isFinite(ageHours)) return 0;
  if (ageHours <= 6) return 8;
  if (ageHours <= 24) return 5;
  if (ageHours <= 72) return 2;
  return 0;
}

function itemScore(type: FeedItemType, createdAt: string, extras = 0) {
  return clampScore(TYPE_BASE[type] + ageBoost(createdAt) + extras);
}

function readDecisions() {
  if (!fs.existsSync(DECISIONS_LOG)) return [];
  const events = fs.readFileSync(DECISIONS_LOG, 'utf8').trim().split('\n').filter(Boolean)
    .map(line => { try { return JSON.parse(line) as DecisionEvent; } catch { return null; } })
    .filter(Boolean) as DecisionEvent[];
  return foldDecisions(events);
}

function readIngestQueue(limit = 10) {
  if (!fs.existsSync(INGEST_QUEUE)) return [];
  return fs.readFileSync(INGEST_QUEUE, 'utf8').trim().split('\n').filter(Boolean).slice(-limit).reverse()
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
}

function promptFor(item: Pick<FeedItem, 'title' | 'summary' | 'whyItMatters' | 'nextAction' | 'evidence' | 'evidencePaths' | 'safety'>) {
  return [
    `MAZos feed item: ${item.title}`,
    ``,
    `SUMMARY: ${item.summary}`,
    `WHY IT MATTERS: ${item.whyItMatters}`,
    `NEXT ACTION: ${item.nextAction}`,
    `SAFETY: ${item.safety}`,
    ``,
    `Evidence:`,
    ...(item.evidence.length ? item.evidence.map(e => `- ${e}`) : ['- No evidence attached.']),
    ``,
    `Read first:`,
    ...(item.evidencePaths.length ? item.evidencePaths.map(p => `- ${p}`) : ['- Use the linked MAZos API/source.']),
    ``,
    `Stay prompt-first. Do not run shell, push, scrape private content, or mutate data unless Maz explicitly asks.`,
  ].join('\n');
}

function withPrompt(item: FeedItem): FeedItem {
  return { ...item, copyPrompt: item.copyPrompt || promptFor(item) };
}

function decisionItems(warnings: string[]): FeedItem[] {
  try {
    return readDecisions().slice(0, 10).map(d => {
      const open = d.status === 'open';
      const item: FeedItem = {
        id: `decision:${d.id}`,
        createdAt: d.resolvedAt || d.createdAt,
        updatedAt: d.resolvedAt || undefined,
        type: 'decision',
        source: d.source,
        title: open ? `Human gate open: ${d.question}` : `Human gate ${d.status}: ${d.question}`,
        summary: d.context || d.resolution || 'Decision inbox event.',
        whyItMatters: open ? 'An agent or loop is blocked until Maz answers this.' : 'A human gate changed what the waiting agent is allowed to do.',
        nextAction: open ? 'Open the Decision Inbox and resolve the gate.' : 'Copy the resolution prompt back to the waiting agent if it has not resumed.',
        evidence: [d.context, d.resolution].filter(Boolean),
        evidencePaths: [DECISIONS_LOG],
        safety: 'L1',
        score: itemScore('decision', d.resolvedAt || d.createdAt, open ? 0 : -15),
        requiresAttention: open,
        status: open ? 'active' : 'resolved',
        href: '/#LOOPS',
      };
      return withPrompt(item);
    });
  } catch (error) {
    warnings.push(`Decision feed unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

function spineItems(warnings: string[]): FeedItem[] {
  try {
    const spine = buildShippingSpine();
    const v = spine.verdict;
    const item: FeedItem = {
      id: `shipping-spine:${idFor(v.product, v.action, spine.generatedAt.slice(0, 13))}`,
      createdAt: spine.generatedAt,
      type: 'shipping-spine',
      source: '/api/mazos/shipping-spine',
      product: v.product,
      title: `Ship next: ${v.product}`,
      summary: v.action,
      whyItMatters: v.why,
      nextAction: v.action,
      evidence: [`owner ${v.owner}`, `safety ${v.safety}`, `${spine.rows.length} product row(s) ranked`],
      evidencePaths: spine.rows.find(r => r.product === v.product)?.evidencePaths || [],
      safety: v.safety,
      score: itemScore('shipping-spine', spine.generatedAt, 0),
      requiresAttention: true,
      status: 'active',
      href: '/api/mazos/shipping-spine',
    };
    return [withPrompt(item)];
  } catch (error) {
    warnings.push(`Shipping Spine feed unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

function runItems(warnings: string[]): FeedItem[] {
  try {
    return readRuns(10).map((r: any) => {
      const failed = !r.success;
      const item: FeedItem = {
        id: `run:${r.finishedAt || r.startedAt}:${r.actionId}`,
        createdAt: r.finishedAt || r.startedAt || new Date().toISOString(),
        type: 'run',
        source: r.actionId || 'run-history',
        title: `${failed ? 'Run failed' : 'Run passed'}: ${r.label || r.actionId}`,
        summary: r.commandPreview || 'MAZos action run.',
        whyItMatters: failed ? 'A failed check or action can block shipping until reviewed.' : 'A passed run is useful proof for handoff or release notes.',
        nextAction: failed ? (r.nextSuggestedAction || 'Copy the output into Hermes and ask for a focused fix.') : 'Use this as proof if it supports the current Shipping Spine action.',
        evidence: [String(r.stdout || r.stderr || '').split('\n').filter(Boolean)[0] || 'No output captured.'],
        evidencePaths: [],
        safety: failed ? 'L2' : 'L1',
        score: itemScore('run', r.finishedAt || r.startedAt || new Date().toISOString(), failed ? 15 : -15),
        requiresAttention: failed,
        status: failed ? 'active' : 'resolved',
        href: '/#SYSTEM',
      };
      return withPrompt(item);
    });
  } catch (error) {
    warnings.push(`Run feed unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

function staleItems(warnings: string[]): FeedItem[] {
  try {
    const repos = scanRepos();
    return computeStaleFindings(repos).slice(0, 8).map(f => {
      const item: FeedItem = {
        id: `stale:${f.repoId}:${idFor(f.title, f.evidence)}`,
        createdAt: new Date().toISOString(),
        type: 'stale-work',
        source: 'stale-radar',
        product: f.repoLabel,
        title: `${f.repoLabel}: ${f.title}`,
        summary: f.evidence,
        whyItMatters: 'Stale dirty or unpushed work creates hidden delivery risk and confuses agent handoffs.',
        nextAction: f.nextCommand,
        evidence: [f.evidence],
        evidencePaths: [],
        safety: f.severity === 'critical' ? 'L3' : 'L2',
        score: itemScore('stale-work', new Date().toISOString(), f.severity === 'critical' ? 10 : 0),
        requiresAttention: f.severity !== 'info',
        status: 'active',
        href: '/#PROJECTS',
      };
      return withPrompt(item);
    });
  } catch (error) {
    warnings.push(`Stale Radar feed unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

function shipItems(warnings: string[]): FeedItem[] {
  try {
    const ship = buildShipLog();
    return ship.days.flatMap(day => day.commits.slice(0, 6).map(c => {
      const item: FeedItem = {
        id: `ship:${c.repo}:${c.hash}`,
        createdAt: `${c.day}T12:00:00.000Z`,
        type: 'ship-log',
        source: 'git-log',
        product: c.repo,
        title: `${c.repo}: ${c.subject}`,
        summary: `Commit ${c.hash} on ${c.day}.`,
        whyItMatters: 'Recent commits are proof of momentum and may change the next handoff context.',
        nextAction: 'Use this commit as evidence if it supports the current Shipping Spine priority.',
        evidence: [`${c.repo} ${c.hash}`, c.subject],
        evidencePaths: [],
        safety: 'L1',
        score: itemScore('ship-log', `${c.day}T12:00:00.000Z`),
        requiresAttention: false,
        status: 'resolved',
      };
      return withPrompt(item);
    })).slice(0, 10);
  } catch (error) {
    warnings.push(`Ship Log feed unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

function intakeItems(warnings: string[]): FeedItem[] {
  try {
    return readIngestQueue(8).map((q: any) => {
      const createdAt = q.queuedAt || new Date().toISOString();
      const label = q.url || q.fileName || 'Queued source';
      const item: FeedItem = {
        id: `intake:${idFor(label, createdAt)}`,
        createdAt,
        type: 'intake',
        source: q.sourceType || 'intake',
        product: q.target || undefined,
        title: `Intake queued: ${q.sourceType || 'source'}`,
        summary: label,
        whyItMatters: 'New source material may change product context or research direction.',
        nextAction: 'Drain or review the intake queue with a prompt-first agent session.',
        evidence: [label, q.notes || '', q.tags || ''].filter(Boolean),
        evidencePaths: [INGEST_QUEUE],
        safety: ['instagram', 'x', 'tiktok'].includes(q.sourceType) ? 'L4' : 'L1',
        score: itemScore('intake', createdAt, ['instagram', 'x', 'tiktok'].includes(q.sourceType) ? 10 : 0),
        requiresAttention: true,
        status: 'new',
        href: '/#INTAKE',
      };
      return withPrompt(item);
    });
  } catch (error) {
    warnings.push(`Intake feed unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

function openWikiItems(warnings: string[]): FeedItem[] {
  try {
    const ow = getOpenWikiStatus();
    const gap = ow.knowledgeGaps[0];
    const item: FeedItem = {
      id: `openwiki:${ow.generatedAt.slice(0, 13)}:${ow.counts.wikiPages}:${ow.counts.capturedContent}`,
      createdAt: ow.generatedAt,
      type: 'openwiki',
      source: 'openwiki',
      product: 'OpenWiki',
      title: `OpenWiki health ${ow.healthScore}/100`,
      summary: `${ow.counts.wikiPages} page(s), ${ow.counts.capturedContent} capture(s), ${ow.counts.weeklyReports} report(s).`,
      whyItMatters: 'OpenWiki is part of MAZos agent memory; gaps reduce handoff quality.',
      nextAction: gap || 'Use OpenWiki as read-only local context for the next agent handoff.',
      evidence: ow.latestPages.slice(0, 3).map(p => p.title),
      evidencePaths: [ow.paths.db, ow.paths.source],
      safety: 'L1',
      score: itemScore('openwiki', ow.generatedAt, gap ? 10 : -10),
      requiresAttention: !!gap,
      status: gap ? 'active' : 'resolved',
      href: '/openwiki',
    };
    return [withPrompt(item)];
  } catch (error) {
    warnings.push(`OpenWiki feed unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

function applyFilters(items: FeedItem[], options: BuildFeedOptions) {
  return items.filter(item => {
    if (options.product && item.product !== options.product) return false;
    if (options.type && item.type !== options.type) return false;
    if (options.attentionOnly && !item.requiresAttention) return false;
    return true;
  });
}

export function buildFeed(options: BuildFeedOptions = {}): FeedResponse {
  const warnings: string[] = [];
  const items = [
    ...decisionItems(warnings),
    ...spineItems(warnings),
    ...runItems(warnings),
    ...staleItems(warnings),
    ...shipItems(warnings),
    ...intakeItems(warnings),
    ...openWikiItems(warnings),
  ].sort((a, b) =>
    Number(b.requiresAttention) - Number(a.requiresAttention) ||
    b.score - a.score ||
    b.createdAt.localeCompare(a.createdAt)
  );

  const filtered = applyFilters(items, options).slice(0, Math.min(Math.max(options.limit || 12, 1), 30));
  const top = filtered[0] || null;
  const spine = items.find(i => i.type === 'shipping-spine');
  const changedWhatShipsNext = !!top && !!spine && top.id !== spine.id && top.score >= spine.score;

  return {
    generatedAt: new Date().toISOString(),
    mode: process.env.VERCEL ? 'hosted-fallback' : 'local',
    verdict: {
      changedWhatShipsNext,
      headline: top ? `${top.title}` : 'No feed signals found.',
      nextAction: top ? top.nextAction : 'Refresh MAZos after shipping activity, intake, or agent runs.',
      topItemId: top?.id || null,
    },
    filters: {
      products: Array.from(new Set(items.map(i => i.product).filter(Boolean))) as string[],
      types: Array.from(new Set(items.map(i => i.type))),
      attentionCount: items.filter(i => i.requiresAttention).length,
    },
    items: filtered,
    degraded: warnings.length > 0,
    warnings,
  };
}
