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
import { getSystemInternals } from './systemInfo';
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

type Spine = ReturnType<typeof buildShippingSpine>;
type MoneyWeight = (product?: string) => number;

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

function readIngestQueue(limit = 5) {
  if (!fs.existsSync(INGEST_QUEUE)) return [];
  return fs.readFileSync(INGEST_QUEUE, 'utf8').trim().split('\n').filter(Boolean).slice(-limit).reverse()
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
}

function promptFor(item: Pick<FeedItem, 'title' | 'summary' | 'whyItMatters' | 'nextAction' | 'evidence' | 'evidencePaths' | 'safety' | 'product' | 'type'>, verify: string[] = []) {
  return [
    `You are handling one MAZos feed item. Scope: this item only.`,
    ``,
    `OBJECTIVE: ${item.nextAction}`,
    `CONTEXT: [${item.type}${item.product ? ` · ${item.product}` : ''}] ${item.title} — ${item.summary}`,
    `WHY IT MATTERS: ${item.whyItMatters}`,
    `SAFETY CEILING: ${item.safety}`,
    ``,
    `EVIDENCE:`,
    ...(item.evidence.length ? item.evidence.map(e => `- ${e}`) : ['- No evidence attached; verify from the read-first paths.']),
    ``,
    `READ FIRST:`,
    ...(item.evidencePaths.length ? item.evidencePaths.map(p => `- ${p}`) : ['- Use the linked MAZos API/source.']),
    ...(verify.length ? [``, `VERIFY WITH:`, ...verify.map(v => `- ${v}`)] : []),
    ``,
    `REPORT BACK: 1) what you found, 2) what you changed or recommend, 3) exact verify output, 4) anything blocked and why.`,
    `Stay prompt-first. Do not run shell beyond the verify commands, push, scrape private content, or mutate data unless Maz explicitly asks.`,
  ].join('\n');
}

function withPrompt(item: FeedItem, verify: string[] = []): FeedItem {
  return { ...item, copyPrompt: item.copyPrompt || promptFor(item, verify) };
}

function decisionItems(warnings: string[]): FeedItem[] {
  try {
    const all = readDecisions();
    const open = all.filter(d => d.status === 'open');
    const resolved = all.filter(d => d.status !== 'open').slice(0, 3);
    return [...open, ...resolved].map(d => {
      const isOpen = d.status === 'open';
      const item: FeedItem = {
        id: `decision:${d.id}`,
        createdAt: d.resolvedAt || d.createdAt,
        updatedAt: d.resolvedAt || undefined,
        type: 'decision',
        source: d.source,
        title: isOpen ? `Human gate open: ${d.question}` : `Human gate ${d.status}: ${d.question}`,
        summary: d.context || d.resolution || 'Decision inbox event.',
        whyItMatters: isOpen ? 'An agent or loop is blocked until Maz answers this — every blocked hour is unshipped work.' : 'A human gate changed what the waiting agent is allowed to do.',
        nextAction: isOpen ? 'Open the Decision Inbox (LOOPS tab) and resolve this gate now.' : 'Copy the resolution prompt back to the waiting agent if it has not resumed.',
        evidence: [d.context, d.resolution].filter(Boolean),
        evidencePaths: [DECISIONS_LOG],
        safety: 'L1',
        score: itemScore('decision', d.resolvedAt || d.createdAt, isOpen ? 0 : -15),
        requiresAttention: isOpen,
        status: isOpen ? 'active' : 'resolved',
        href: '/#LOOPS',
      };
      return withPrompt(item);
    });
  } catch (error) {
    warnings.push(`Decision feed unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

function spineItems(spine: Spine | null, money: MoneyWeight): FeedItem[] {
  if (!spine) return [];
  const v = spine.verdict;
  const topRow = spine.rows.find(r => r.product === v.product);
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
    evidencePaths: topRow?.evidencePaths || [],
    safety: v.safety,
    score: itemScore('shipping-spine', spine.generatedAt, money(v.product)),
    requiresAttention: true,
    status: 'active',
    href: '/api/mazos/shipping-spine',
    // The spine handoff prompt is already scoped (repo, branch, verify, done
    // criteria) — reuse it instead of the generic feed prompt.
    copyPrompt: topRow?.handoffPrompt,
  };
  return [withPrompt(item)];
}

function runItems(warnings: string[]): FeedItem[] {
  try {
    const runs = readRuns(10) as any[];
    const failed = runs.filter(r => !r.success);
    const passed = runs.filter(r => r.success).slice(0, 2); // last 2 passes are proof; older passes are noise
    return [...failed, ...passed].map((r: any) => {
      const isFail = !r.success;
      const item: FeedItem = {
        id: `run:${r.finishedAt || r.startedAt}:${r.actionId}`,
        createdAt: r.finishedAt || r.startedAt || new Date().toISOString(),
        type: 'run',
        source: r.actionId || 'run-history',
        title: `${isFail ? 'Run failed' : 'Run passed'}: ${r.label || r.actionId}`,
        summary: r.commandPreview || 'MAZos action run.',
        whyItMatters: isFail ? `A failing ${r.label || r.actionId} check blocks shipping until reviewed.` : 'A passed run is proof for the current handoff or release notes.',
        nextAction: isFail ? (r.nextSuggestedAction || `Fix the first error in the output, then re-run ${r.actionId}.`) : 'Attach this as proof if it supports the current Shipping Spine action.',
        evidence: [String(r.stdout || r.stderr || '').split('\n').filter(Boolean)[0] || 'No output captured.'],
        evidencePaths: [],
        safety: isFail ? 'L2' : 'L1',
        score: itemScore('run', r.finishedAt || r.startedAt || new Date().toISOString(), isFail ? 15 : -15),
        requiresAttention: isFail,
        status: isFail ? 'active' : 'resolved',
        href: '/#SYSTEM',
      };
      return withPrompt(item, r.commandPreview ? [r.commandPreview] : []);
    });
  } catch (error) {
    warnings.push(`Run feed unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

function staleItems(warnings: string[], money: MoneyWeight): FeedItem[] {
  try {
    const repos = scanRepos();
    return computeStaleFindings(repos).slice(0, 8).map(f => {
      const repo = repos.find(r => r.id === f.repoId);
      const item: FeedItem = {
        id: `stale:${f.repoId}:${idFor(f.title, f.evidence)}`,
        createdAt: new Date().toISOString(),
        type: 'stale-work',
        source: 'stale-radar',
        product: f.repoLabel,
        title: `${f.repoLabel}: ${f.title}`,
        summary: f.evidence,
        whyItMatters: `Unfinished work in ${f.repoLabel} rots fast: it blocks clean handoffs and hides shipped-vs-not state.`,
        nextAction: f.nextCommand,
        evidence: [f.evidence, repo ? `repo ${repo.path} · branch ${repo.branch}` : ''].filter(Boolean),
        evidencePaths: repo ? [repo.path] : [],
        safety: f.severity === 'critical' ? 'L3' : 'L2',
        score: itemScore('stale-work', new Date().toISOString(), (f.severity === 'critical' ? 10 : 0) + money(f.repoLabel)),
        requiresAttention: f.severity !== 'info',
        status: 'active',
        href: '/#PROJECTS',
      };
      return withPrompt(item, ['git status --short', 'git log --oneline -3']);
    });
  } catch (error) {
    warnings.push(`Stale Radar feed unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

function shipItems(warnings: string[], money: MoneyWeight, spineProduct?: string): FeedItem[] {
  try {
    const ship = buildShipLog();
    return ship.days.flatMap(day => day.commits.slice(0, 4).map(c => {
      const onSpine = !!spineProduct && c.repo.toLowerCase() === spineProduct.toLowerCase();
      const item: FeedItem = {
        id: `ship:${c.repo}:${c.hash}`,
        createdAt: `${c.day}T12:00:00.000Z`,
        type: 'ship-log',
        source: 'git-log',
        product: c.repo,
        title: `${c.repo}: ${c.subject}`,
        summary: `Commit ${c.hash} on ${c.day}.`,
        whyItMatters: onSpine ? `${c.repo} is the current Shipping Spine priority — this commit is direct progress on it.` : 'Recent commit; proof of momentum for handoff context.',
        nextAction: onSpine ? 'Fold this commit into the current Shipping Spine handoff as proof.' : 'No action needed unless it contradicts the current priority.',
        evidence: [`${c.repo} ${c.hash}`, c.subject],
        evidencePaths: [],
        safety: 'L1',
        score: itemScore('ship-log', `${c.day}T12:00:00.000Z`, money(c.repo) + (onSpine ? 5 : -5)),
        requiresAttention: false,
        status: 'resolved',
      };
      return withPrompt(item);
    })).slice(0, 6);
  } catch (error) {
    warnings.push(`Ship Log feed unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

function intakeItems(warnings: string[], money: MoneyWeight): FeedItem[] {
  try {
    return readIngestQueue(5).map((q: any) => {
      const createdAt = q.queuedAt || new Date().toISOString();
      const label = q.url || q.fileName || 'Queued source';
      const social = ['instagram', 'x', 'tiktok'].includes(q.sourceType);
      const item: FeedItem = {
        id: `intake:${idFor(label, createdAt)}`,
        createdAt,
        type: 'intake',
        source: q.sourceType || 'intake',
        product: q.target || undefined,
        title: `Intake queued: ${q.sourceType || 'source'}`,
        summary: label,
        whyItMatters: `Queued for ${q.target || 'processing'}; unprocessed intake ages into noise within days.`,
        nextAction: `Process this into ${q.target || 'the target system'} with a prompt-first agent session, or delete it from the queue.`,
        evidence: [label, q.notes || '', q.tags || ''].filter(Boolean),
        evidencePaths: [INGEST_QUEUE],
        safety: social ? 'L4' : 'L1',
        score: itemScore('intake', createdAt, (social ? 10 : 0) + money(q.target)),
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

async function systemItems(warnings: string[]): Promise<FeedItem[]> {
  try {
    const sys = await getSystemInternals({ sampleCpu: false });
    if (!sys.local || (!sys.pressure.ram && !sys.pressure.vram)) return [];
    const what = [sys.pressure.ram ? `RAM ${sys.ram.usedPct}%` : '', sys.pressure.vram && sys.gpu ? `VRAM ${Math.round((sys.gpu.vramUsedMb / sys.gpu.vramTotalMb) * 100)}%` : ''].filter(Boolean).join(' · ');
    const item: FeedItem = {
      id: `system:pressure:${sys.generatedAt.slice(0, 13)}`,
      createdAt: sys.generatedAt,
      type: 'system',
      source: '/api/mazos/system',
      title: `Memory pressure: ${what}`,
      summary: `${sys.host} — RAM ${sys.ram.usedMb}/${sys.ram.totalMb} MB${sys.gpu ? `, VRAM ${sys.gpu.vramUsedMb}/${sys.gpu.vramTotalMb} MB (${sys.gpu.name})` : ''}.`,
      whyItMatters: 'Local builds, dev servers, and model inference degrade or crash under memory pressure — agent runs will start failing for the wrong reason.',
      nextAction: 'Close heavy processes (browsers, stale dev servers, local models) before launching the next agent or build.',
      evidence: [what],
      evidencePaths: [],
      safety: 'L1',
      score: itemScore('system', sys.generatedAt, 40),
      requiresAttention: true,
      status: 'active',
    };
    return [withPrompt(item)];
  } catch (error) {
    warnings.push(`System internals unavailable: ${error instanceof Error ? error.message : String(error)}`);
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

export async function buildFeed(options: BuildFeedOptions = {}): Promise<FeedResponse> {
  const warnings: string[] = [];

  let spine: Spine | null = null;
  try {
    spine = buildShippingSpine();
  } catch (error) {
    warnings.push(`Shipping Spine feed unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
  // Revenue weighting: items touching a high-money playbook product outrank
  // equal signals on low-money products.
  const moneyByProduct = new Map((spine?.rows || []).map(r => [r.product.toLowerCase(), r.moneyLabel]));
  const money: MoneyWeight = product => {
    const label = product ? moneyByProduct.get(product.toLowerCase()) : undefined;
    return label === 'high' ? 8 : label === 'medium' ? 4 : 0;
  };

  const items = [
    ...decisionItems(warnings),
    ...spineItems(spine, money),
    ...runItems(warnings),
    ...staleItems(warnings, money),
    ...shipItems(warnings, money, spine?.verdict.product),
    ...intakeItems(warnings, money),
    ...openWikiItems(warnings),
    ...(await systemItems(warnings)),
  ].sort((a, b) =>
    Number(b.requiresAttention) - Number(a.requiresAttention) ||
    b.score - a.score ||
    b.createdAt.localeCompare(a.createdAt)
  );

  const filtered = applyFilters(items, options).slice(0, Math.min(Math.max(options.limit || 12, 1), 30));
  const top = filtered[0] || null;
  const spineItem = items.find(i => i.type === 'shipping-spine');
  const changedWhatShipsNext = !!top && !!spineItem && top.id !== spineItem.id && top.score >= spineItem.score;

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
