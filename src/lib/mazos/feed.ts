import fs from 'fs';
import crypto from 'crypto';
import { DECISIONS_LOG, INGEST_QUEUE, PATHS } from './paths';
import { foldDecisions, type DecisionEvent } from './decisions';
import { readRuns } from './logStore';
import { buildShipLog } from './shipLog';
import { buildShippingSpine } from './shippingSpine';
import { scanRepos } from './repoScanner';
import { computeStaleFindings } from './staleRadar';
import { getOpenWikiStatus } from './openWiki';
import { getSystemInternals } from './systemInfo';
import { readFeedState, stateFor, type FeedUserState } from './feedState';
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

export type FeedLane =
  | 'needs-decision'
  | 'blocked'
  | 'failed-checks'
  | 'stale-work'
  | 'ready-to-ship'
  | 'knowledge-gaps'
  | 'system-pressure'
  | 'watch'
  | 'done';

export type EvidenceQuality = 'strong' | 'partial' | 'weak' | 'missing';

export type ScoreBreakdown = {
  urgency: number;
  revenue: number;
  blocker: number;
  evidence: number;
  risk: number;
  recency: number;
  shippingSpineFit: number;
  systemPressure: number;
  total: number;
};

export type FeedItem = {
  id: string;
  createdAt: string;
  updatedAt?: string;
  type: FeedItemType;
  lane: FeedLane;
  source: string;
  product?: string;
  title: string;
  summary: string;
  whyItMatters: string;
  nextAction: string;
  evidence: string[];
  evidencePaths: string[];
  evidenceQuality: EvidenceQuality;
  safety: SafetyLevel;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  requiresAttention: boolean;
  status: 'new' | 'active' | 'resolved' | 'muted';
  userState: FeedUserState;
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
    unreadCount: number;
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

// Actionability base by type: what most likely needs a human/agent to act.
const TYPE_URGENCY: Record<FeedItemType, number> = {
  decision: 95,
  'shipping-spine': 90,
  run: 70,
  'stale-work': 75,
  'ship-log': 65,
  intake: 55,
  openwiki: 45,
  system: 30,
};

const PRODUCT_REPO: Record<string, string> = {
  jobfilter: PATHS.jobfilter,
  recall: PATHS.recall,
  mazos: PATHS.mazos_ui,
  openflowkit: PATHS.openflowkit,
};

function idFor(...parts: string[]) {
  return crypto.createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 12);
}

function ageBoost(iso: string) {
  const ageHours = (Date.now() - new Date(iso).getTime()) / 36e5;
  if (!Number.isFinite(ageHours)) return 0;
  if (ageHours <= 6) return 8;
  if (ageHours <= 24) return 5;
  if (ageHours <= 72) return 2;
  return 0;
}

function riskPenalty(safety: SafetyLevel) {
  return safety === 'L4' || safety === 'L5' ? -6 : safety === 'L3' ? -3 : 0;
}

function evidenceQualityFor(i: { evidence: string[]; evidencePaths: string[]; href?: string; createdAt: string }): EvidenceQuality {
  let s = Math.min(i.evidencePaths.length, 2);
  if (i.evidence.filter(Boolean).length >= 2) s += 1;
  if (i.href) s += 1;
  if (Date.now() - new Date(i.createdAt).getTime() < 24 * 36e5) s += 1;
  return s >= 4 ? 'strong' : s === 3 ? 'partial' : s >= 1 ? 'weak' : 'missing';
}

const EVIDENCE_WEIGHT: Record<EvidenceQuality, number> = { strong: 4, partial: 2, weak: 0, missing: -4 };

function makeScore(parts: Omit<ScoreBreakdown, 'total'>): ScoreBreakdown {
  const raw = parts.urgency + parts.revenue + parts.blocker + parts.evidence + parts.risk + parts.recency + parts.shippingSpineFit + parts.systemPressure;
  return { ...parts, total: Math.max(0, Math.min(100, Math.round(raw))) };
}

type Draft = Omit<FeedItem, 'score' | 'scoreBreakdown' | 'evidenceQuality' | 'userState' | 'copyPrompt'> & { copyPrompt?: string };
type Extras = Partial<Pick<ScoreBreakdown, 'urgency' | 'revenue' | 'blocker' | 'shippingSpineFit' | 'systemPressure'>>;

// Single scoring path so every item carries an explainable breakdown.
function finalize(draft: Draft, extras: Extras = {}, verify: string[] = []): FeedItem {
  const evidenceQuality = evidenceQualityFor(draft);
  const scoreBreakdown = makeScore({
    urgency: TYPE_URGENCY[draft.type] + (extras.urgency || 0),
    revenue: extras.revenue || 0,
    blocker: extras.blocker || 0,
    evidence: EVIDENCE_WEIGHT[evidenceQuality],
    risk: riskPenalty(draft.safety),
    recency: ageBoost(draft.createdAt),
    shippingSpineFit: extras.shippingSpineFit || 0,
    systemPressure: extras.systemPressure || 0,
  });
  const item: FeedItem = { ...draft, evidenceQuality, scoreBreakdown, score: scoreBreakdown.total, userState: 'unread' };
  return { ...item, copyPrompt: draft.copyPrompt || promptFor(item, verify) };
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
  const repo = item.product ? PRODUCT_REPO[item.product.toLowerCase()] : undefined;
  return [
    `You are handling one MAZos feed item. Scope: this item only.`,
    ``,
    `MISSION: ${item.nextAction}`,
    `CONTEXT: [${item.type}${item.product ? ` · ${item.product}` : ''}] ${item.title} — ${item.summary}`,
    `WHY IT MATTERS: ${item.whyItMatters}`,
    ...(repo ? [`REPO: ${repo}`] : []),
    `SAFETY CEILING: ${item.safety}`,
    ``,
    `EVIDENCE:`,
    ...(item.evidence.length ? item.evidence.map(e => `- ${e}`) : ['- No evidence attached; verify from the read-first paths.']),
    ``,
    `READ FIRST:`,
    ...(item.evidencePaths.length ? item.evidencePaths.map(p => `- ${p}`) : ['- Use the linked MAZos API/source.']),
    ``,
    `SUCCESS CRITERIA:`,
    `- The mission above is done, or you report exactly why it cannot be done.`,
    `- Verify commands pass and their output is quoted in the report.`,
    ...(verify.length ? [``, `VERIFY WITH:`, ...verify.map(v => `- ${v}`)] : []),
    ``,
    `FORBIDDEN:`,
    `- No destructive commands, force push, credential changes, or global installs.`,
    `- No push to GitHub unless Maz explicitly asks.`,
    `- Do not touch repos, branches, or files outside this item's scope.`,
    ``,
    `STOP AND ASK (file in the MAZos Decision Inbox instead of proceeding) if: evidence contradicts this item, secrets/credentials appear, or the fix would delete data.`,
    ``,
    `REPORT BACK: 1) what you found, 2) what you changed or recommend, 3) exact verify output, 4) anything blocked and why.`,
  ].join('\n');
}

function decisionItems(warnings: string[]): FeedItem[] {
  try {
    const all = readDecisions();
    const open = all.filter(d => d.status === 'open');
    const resolved = all.filter(d => d.status !== 'open').slice(0, 3);
    return [...open, ...resolved].map(d => {
      const isOpen = d.status === 'open';
      return finalize({
        id: `decision:${d.id}`,
        createdAt: d.resolvedAt || d.createdAt,
        updatedAt: d.resolvedAt || undefined,
        type: 'decision',
        lane: isOpen ? 'needs-decision' : 'watch',
        source: d.source,
        title: isOpen ? `Human gate open: ${d.question}` : `Human gate ${d.status}: ${d.question}`,
        summary: d.context || d.resolution || 'Decision inbox event.',
        whyItMatters: isOpen ? 'An agent or loop is blocked until Maz answers this — every blocked hour is unshipped work.' : 'A human gate changed what the waiting agent is allowed to do.',
        nextAction: isOpen ? 'Open the Decision Inbox (LOOPS tab) and resolve this gate now.' : 'Copy the resolution prompt back to the waiting agent if it has not resumed.',
        evidence: [d.context, d.resolution].filter(Boolean),
        evidencePaths: [DECISIONS_LOG],
        safety: 'L1',
        requiresAttention: isOpen,
        status: isOpen ? 'active' : 'resolved',
        href: '/#WORK',
      }, { urgency: isOpen ? 0 : -15, blocker: isOpen ? 8 : 0 });
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
  return [finalize({
    id: `shipping-spine:${idFor(v.product, v.action, spine.generatedAt.slice(0, 13))}`,
    createdAt: spine.generatedAt,
    type: 'shipping-spine',
    lane: topRow?.blocked ? 'blocked' : 'ready-to-ship',
    source: '/api/mazos/shipping-spine',
    product: v.product,
    title: `Ship next: ${v.product}`,
    summary: v.action,
    whyItMatters: v.why,
    nextAction: v.action,
    evidence: [`owner ${v.owner}`, `safety ${v.safety}`, topRow?.blocked ? `BLOCKED: ${topRow.blocker}` : `${spine.rows.length} product row(s) ranked`],
    evidencePaths: topRow?.evidencePaths || [],
    safety: v.safety,
    requiresAttention: true,
    status: 'active',
    href: '/api/mazos/shipping-spine',
    // The spine handoff prompt is already scoped (repo, branch, verify, done
    // criteria) — reuse it instead of the generic feed prompt.
    copyPrompt: topRow?.handoffPrompt,
  }, { revenue: money(v.product), shippingSpineFit: 5, blocker: topRow?.blocked ? 10 : 0 })];
}

function runItems(warnings: string[]): FeedItem[] {
  try {
    const runs = readRuns(10) as any[];
    const failed = runs.filter(r => !r.success);
    const passed = runs.filter(r => r.success).slice(0, 2); // last 2 passes are proof; older passes are noise
    return [...failed, ...passed].map((r: any) => {
      const isFail = !r.success;
      return finalize({
        id: `run:${r.finishedAt || r.startedAt}:${r.actionId}`,
        createdAt: r.finishedAt || r.startedAt || new Date().toISOString(),
        type: 'run',
        lane: isFail ? 'failed-checks' : 'watch',
        source: r.actionId || 'run-history',
        title: `${isFail ? 'Run failed' : 'Run passed'}: ${r.label || r.actionId}`,
        summary: r.commandPreview || 'MAZos action run.',
        whyItMatters: isFail ? `A failing ${r.label || r.actionId} check blocks shipping until reviewed.` : 'A passed run is proof for the current handoff or release notes.',
        nextAction: isFail ? (r.nextSuggestedAction || `Fix the first error in the output, then re-run ${r.actionId}.`) : 'Attach this as proof if it supports the current Shipping Spine action.',
        evidence: [String(r.stdout || r.stderr || '').split('\n').filter(Boolean)[0] || 'No output captured.'],
        evidencePaths: [],
        safety: isFail ? 'L2' : 'L1',
        requiresAttention: isFail,
        status: isFail ? 'active' : 'resolved',
        href: '/#SYSTEM',
      }, { urgency: isFail ? 0 : -15, blocker: isFail ? 15 : 0 }, r.commandPreview ? [r.commandPreview] : []);
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
      const critical = f.severity === 'critical';
      return finalize({
        id: `stale:${f.repoId}:${idFor(f.title, f.evidence)}`,
        createdAt: new Date().toISOString(),
        type: 'stale-work',
        lane: critical ? 'blocked' : 'stale-work',
        source: 'stale-radar',
        product: f.repoLabel,
        title: `${f.repoLabel}: ${f.title}`,
        summary: f.evidence,
        whyItMatters: `Unfinished work in ${f.repoLabel} rots fast: it blocks clean handoffs and hides shipped-vs-not state.`,
        nextAction: f.nextCommand,
        evidence: [f.evidence, repo ? `repo ${repo.path} · branch ${repo.branch}` : ''].filter(Boolean),
        evidencePaths: repo ? [repo.path] : [],
        safety: critical ? 'L3' : 'L2',
        requiresAttention: f.severity !== 'info',
        status: 'active',
        href: '/#WORK',
      }, { revenue: money(f.repoLabel), blocker: critical ? 10 : 0 }, ['git status --short', 'git log --oneline -3']);
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
      return finalize({
        id: `ship:${c.repo}:${c.hash}`,
        createdAt: `${c.day}T12:00:00.000Z`,
        type: 'ship-log',
        lane: onSpine ? 'ready-to-ship' : 'watch',
        source: 'git-log',
        product: c.repo,
        title: `${c.repo}: ${c.subject}`,
        summary: `Commit ${c.hash} on ${c.day}.`,
        whyItMatters: onSpine ? `${c.repo} is the current Shipping Spine priority — this commit is direct progress on it.` : 'Recent commit; proof of momentum for handoff context.',
        nextAction: onSpine ? 'Fold this commit into the current Shipping Spine handoff as proof.' : 'No action needed unless it contradicts the current priority.',
        evidence: [`${c.repo} ${c.hash}`, c.subject],
        evidencePaths: [],
        safety: 'L1',
        requiresAttention: false,
        status: 'resolved',
      }, { revenue: money(c.repo), shippingSpineFit: onSpine ? 5 : -5 });
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
      return finalize({
        id: `intake:${idFor(label, createdAt)}`,
        createdAt,
        type: 'intake',
        lane: 'watch',
        source: q.sourceType || 'intake',
        product: q.target || undefined,
        title: `Intake queued: ${q.sourceType || 'source'}`,
        summary: label,
        whyItMatters: `Queued for ${q.target || 'processing'}; unprocessed intake ages into noise within days.`,
        nextAction: `Process this into ${q.target || 'the target system'} with a prompt-first agent session, or delete it from the queue.`,
        evidence: [label, q.notes || '', q.tags || ''].filter(Boolean),
        evidencePaths: [INGEST_QUEUE],
        safety: social ? 'L4' : 'L1',
        requiresAttention: true,
        status: 'new',
        href: '/#INTAKE',
      }, { urgency: social ? 10 : 0, revenue: money(q.target) });
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
    return [finalize({
      id: `openwiki:${ow.generatedAt.slice(0, 13)}:${ow.counts.wikiPages}:${ow.counts.capturedContent}`,
      createdAt: ow.generatedAt,
      type: 'openwiki',
      lane: gap ? 'knowledge-gaps' : 'watch',
      source: 'openwiki',
      product: 'OpenWiki',
      title: `OpenWiki health ${ow.healthScore}/100`,
      summary: `${ow.counts.wikiPages} page(s), ${ow.counts.capturedContent} capture(s), ${ow.counts.weeklyReports} report(s).`,
      whyItMatters: 'OpenWiki is part of MAZos agent memory; gaps reduce handoff quality.',
      nextAction: gap || 'Use OpenWiki as read-only local context for the next agent handoff.',
      evidence: ow.latestPages.slice(0, 3).map(p => p.title),
      evidencePaths: [ow.paths.db, ow.paths.source],
      safety: 'L1',
      requiresAttention: !!gap,
      status: gap ? 'active' : 'resolved',
      href: '/openwiki',
    }, { urgency: gap ? 10 : -10 })];
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
    return [finalize({
      id: `system:pressure:${sys.generatedAt.slice(0, 13)}`,
      createdAt: sys.generatedAt,
      type: 'system',
      lane: 'system-pressure',
      source: '/api/mazos/system',
      title: `Memory pressure: ${what}`,
      summary: `${sys.host} — RAM ${sys.ram.usedMb}/${sys.ram.totalMb} MB${sys.gpu ? `, VRAM ${sys.gpu.vramUsedMb}/${sys.gpu.vramTotalMb} MB (${sys.gpu.name})` : ''}.`,
      whyItMatters: 'Local builds, dev servers, and model inference degrade or crash under memory pressure — agent runs will start failing for the wrong reason.',
      nextAction: 'Close heavy processes (browsers, stale dev servers, local models) before launching the next agent or build.',
      evidence: [what],
      evidencePaths: [],
      safety: 'L1',
      requiresAttention: true,
      status: 'active',
    }, { systemPressure: 40 })];
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

const PARKED: FeedUserState[] = ['done', 'cleared', 'snoozed'];

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

  const states = readFeedState();
  const items = [
    ...decisionItems(warnings),
    ...spineItems(spine, money),
    ...runItems(warnings),
    ...staleItems(warnings, money),
    ...shipItems(warnings, money, spine?.verdict.product),
    ...intakeItems(warnings, money),
    ...openWikiItems(warnings),
    ...(await systemItems(warnings)),
  ].map(item => {
    const userState = stateFor(states, item.id);
    // Done/cleared/snoozed items stay in the response (searchable) but park in
    // the done lane and stop demanding attention.
    return PARKED.includes(userState)
      ? { ...item, userState, lane: 'done' as FeedLane, requiresAttention: false }
      : { ...item, userState };
  }).sort((a, b) =>
    Number(PARKED.includes(a.userState)) - Number(PARKED.includes(b.userState)) ||
    Number(b.requiresAttention) - Number(a.requiresAttention) ||
    b.score - a.score ||
    b.createdAt.localeCompare(a.createdAt)
  );

  const filtered = applyFilters(items, options).slice(0, Math.min(Math.max(options.limit || 12, 1), 30));
  const live = filtered.filter(i => !PARKED.includes(i.userState));
  const top = live[0] || null;
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
      unreadCount: items.filter(i => i.userState === 'unread').length,
    },
    items: filtered,
    degraded: warnings.length > 0,
    warnings,
  };
}
