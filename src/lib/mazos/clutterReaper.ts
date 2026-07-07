import { allLoopTemplates, auditLoopUsefulness } from './loopFactory';
import { readLoopReceipts } from './loopReceipts';
import { readInbox, writeInbox, type SourceItem } from './aiSourceInbox';
import { readSkills, writeSkills, type SkillSpec } from './skillFactory';
import { readPacks, seedStarterPacks, writePacks, type Pack } from './loopStore';

export type ReaperTarget = 'source' | 'skill' | 'pack' | 'loop' | 'panel' | 'report';
export type ReaperAction = 'archive' | 'ignore' | 'reject' | 'merge' | 'remove' | 'fix' | 'keep';
export type ReaperSeverity = 'low' | 'medium' | 'high';

export type ReaperRecommendation = {
  id: string;
  target: ReaperTarget;
  targetId: string;
  title: string;
  action: ReaperAction;
  severity: ReaperSeverity;
  reason: string;
  productImpact: string;
  safeToApply: boolean;
};

export type ClutterReaperReport = {
  generatedAt: string;
  productKernel: string[];
  score: number;
  verdict: string;
  recommendations: ReaperRecommendation[];
  quickWins: ReaperRecommendation[];
  blockedActions: ReaperRecommendation[];
  nextAction: string;
};

function rec(input: Omit<ReaperRecommendation, 'id'>): ReaperRecommendation {
  return { id: `${input.target}:${input.targetId}:${input.action}`, ...input };
}

function sourceRecs(items: SourceItem[]): ReaperRecommendation[] {
  return items.flatMap((item) => {
    if (item.status === 'archived' || item.status === 'ignored') return [];
    const out: ReaperRecommendation[] = [];
    if (item.usefulnessScore < 35) {
      out.push(rec({
        target: 'source',
        targetId: item.id,
        title: item.title,
        action: 'ignore',
        severity: 'medium',
        reason: `Usefulness is ${item.usefulnessScore}/100. Low-value saved sources make MAZos feel like a bookmark pile.`,
        productImpact: 'Forces the AI Source Inbox toward decisive capture instead of passive hoarding.',
        safeToApply: true,
      }));
    }
    if (item.trustScore < 40 && item.usefulnessScore < 60) {
      out.push(rec({
        target: 'source',
        targetId: item.id,
        title: item.title,
        action: 'archive',
        severity: 'medium',
        reason: `Trust is ${item.trustScore}/100 and usefulness is not strong enough to justify attention.`,
        productImpact: 'Keeps the sellable workflow focused on trusted, reusable inputs.',
        safeToApply: true,
      }));
    }
    if (item.suggestedAction === 'save_for_later' && item.status === 'new') {
      out.push(rec({
        target: 'source',
        targetId: item.id,
        title: item.title,
        action: 'fix',
        severity: 'low',
        reason: 'This item is undecided. Add notes, turn it into a skill/loop, or archive it.',
        productImpact: 'Prevents “interesting later” from becoming the default state.',
        safeToApply: false,
      }));
    }
    return out;
  });
}

function skillRecs(skills: SkillSpec[]): ReaperRecommendation[] {
  return skills.flatMap((skill) => {
    if (skill.status === 'archived' || skill.status === 'rejected' || skill.status === 'approved') return [];
    if (skill.trustScore < 40 || skill.riskLevel === 'high') {
      return [rec({
        target: 'skill',
        targetId: skill.id,
        title: skill.name,
        action: 'reject',
        severity: skill.riskLevel === 'high' ? 'high' : 'medium',
        reason: `Skill is ${skill.riskLevel} risk with trust ${skill.trustScore}/100. Do not let weak skills become product promises.`,
        productImpact: 'Protects marketplace readiness by rejecting risky or untrusted skill drafts.',
        safeToApply: true,
      })];
    }
    if (skill.usefulnessScore < 45) {
      return [rec({
        target: 'skill',
        targetId: skill.id,
        title: skill.name,
        action: 'archive',
        severity: 'medium',
        reason: `Usefulness is ${skill.usefulnessScore}/100. Archive weak skill drafts unless a loop needs them now.`,
        productImpact: 'Keeps Skill Factory from becoming a prompt graveyard.',
        safeToApply: true,
      })];
    }
    if (skill.status === 'draft' && skill.trustScore >= 60) {
      return [rec({
        target: 'skill',
        targetId: skill.id,
        title: skill.name,
        action: 'fix',
        severity: 'low',
        reason: 'Promising draft should move to test-ready or be archived.',
        productImpact: 'Turns capability ideas into verified assets faster.',
        safeToApply: false,
      })];
    }
    return [];
  });
}

function packRecs(packs: Pack[]): ReaperRecommendation[] {
  return packs.flatMap((pack) => {
    if (pack.status === 'archived' || pack.status === 'approved') return [];
    if (pack.proofReceipts.length === 0 && pack.status !== 'draft') {
      return [rec({
        target: 'pack',
        targetId: pack.id,
        title: pack.name,
        action: 'archive',
        severity: 'medium',
        reason: 'Pack has no proof receipts but is beyond draft. Packs need evidence before they become product surface.',
        productImpact: 'Keeps future marketplace promises honest.',
        safeToApply: true,
      })];
    }
    if (pack.includedLoopIds.length + pack.includedSkillIds.length === 0) {
      return [rec({
        target: 'pack',
        targetId: pack.id,
        title: pack.name,
        action: 'remove',
        severity: 'low',
        reason: 'Pack has no included loops or skills.',
        productImpact: 'Removes empty catalogue items before users see them.',
        safeToApply: false,
      })];
    }
    return [];
  });
}

function loopRecs(): ReaperRecommendation[] {
  const receipts = readLoopReceipts(500);
  return allLoopTemplates().flatMap((loop) => {
    const audit = auditLoopUsefulness(loop);
    const loopReceipts = receipts.filter((receipt) => receipt.loopId === loop.id);
    if (audit.decision === 'remove') {
      return [rec({
        target: 'loop',
        targetId: loop.id,
        title: loop.name,
        action: 'remove',
        severity: 'high',
        reason: audit.gaps[0] || 'Loop is low-value by usefulness audit.',
        productImpact: 'Removes recurring work that does not produce receipts or revenue-facing decisions.',
        safeToApply: false,
      })];
    }
    if (audit.decision === 'merge') {
      return [rec({
        target: 'loop',
        targetId: loop.id,
        title: loop.name,
        action: 'merge',
        severity: 'medium',
        reason: audit.gaps[0] || 'Loop overlaps another workflow.',
        productImpact: 'Reduces loop surface area while preserving useful behavior.',
        safeToApply: false,
      })];
    }
    if (loopReceipts.length === 0 && audit.score < 65) {
      return [rec({
        target: 'loop',
        targetId: loop.id,
        title: loop.name,
        action: 'fix',
        severity: 'medium',
        reason: `No receipts found and usefulness audit is ${audit.score}/100.`,
        productImpact: 'Forces loops to prove they create useful output.',
        safeToApply: false,
      })];
    }
    return [];
  });
}

function staticPanelRecs(): ReaperRecommendation[] {
  return [
    rec({
      target: 'panel',
      targetId: 'system-action-matrix',
      title: 'SYSTEM Action Matrix',
      action: 'merge',
      severity: 'medium',
      reason: 'Manual command grid is useful for maintenance but too raw for the sellable command-centre surface.',
      productImpact: 'Move rare maintenance commands behind command palette or a System details drawer.',
      safeToApply: false,
    }),
    rec({
      target: 'panel',
      targetId: 'intake-source-intake',
      title: 'Legacy Source Intake',
      action: 'merge',
      severity: 'medium',
      reason: 'Source Intake and AI Intelligence Engine now overlap. The product should present one capture pipe.',
      productImpact: 'Make AI Intelligence Engine the primary capture path and demote raw ingest to advanced mode.',
      safeToApply: false,
    }),
  ];
}

function reportRecs(): ReaperRecommendation[] {
  return [
    rec({
      target: 'report',
      targetId: 'root-reports',
      title: 'Historical MAZOS_* reports',
      action: 'keep',
      severity: 'low',
      reason: 'Root reports were already moved under docs/reports. Keep them archived, not in the main UI.',
      productImpact: 'Preserves research without making the product feel like a document museum.',
      safeToApply: false,
    }),
  ];
}

export function buildClutterReaperReport(): ClutterReaperReport {
  const inbox = readInbox();
  const skills = readSkills();
  const existingPacks = readPacks();
  const packs = seedStarterPacks(existingPacks);
  if (packs.length !== existingPacks.length) writePacks(packs);
  const recommendations = [
    ...sourceRecs(inbox),
    ...skillRecs(skills),
    ...packRecs(packs),
    ...loopRecs(),
    ...staticPanelRecs(),
    ...reportRecs(),
  ].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  const safeCount = recommendations.filter((item) => item.safeToApply).length;
  const score = Math.max(0, 100 - recommendations.length * 7 - recommendations.filter((item) => item.severity === 'high').length * 9);
  const nextAction = recommendations.find((item) => item.safeToApply)?.id
    ? `Apply safe cleanup: ${recommendations.find((item) => item.safeToApply)?.title}`
    : recommendations[0]
      ? `Review cleanup recommendation: ${recommendations[0].title}`
      : 'System is lean enough for the next product loop.';

  return {
    generatedAt: new Date().toISOString(),
    productKernel: [
      'Capture messy AI sources once.',
      'Score usefulness and trust.',
      'Convert strong inputs into skills, loops, and packs.',
      'Produce receipts and Morning Brief next actions.',
      'Archive or merge everything else.',
    ],
    score,
    verdict: recommendations.length
      ? `${recommendations.length} cleanup recommendation(s), ${safeCount} safe to apply now.`
      : 'No cleanup recommendations. Keep shipping from the spine.',
    recommendations,
    quickWins: recommendations.filter((item) => item.safeToApply).slice(0, 5),
    blockedActions: recommendations.filter((item) => !item.safeToApply).slice(0, 8),
    nextAction,
  };
}

function severityRank(severity: ReaperSeverity) {
  return severity === 'high' ? 3 : severity === 'medium' ? 2 : 1;
}

export function applyReaperRecommendation(id: string) {
  const report = buildClutterReaperReport();
  const recommendation = report.recommendations.find((item) => item.id === id);
  if (!recommendation) return { ok: false, error: 'Recommendation not found.', report };
  if (!recommendation.safeToApply) return { ok: false, error: 'Recommendation needs human implementation; not safe to auto-apply.', recommendation, report };

  if (recommendation.target === 'source') {
    const items = readInbox().map((item) => item.id === recommendation.targetId
      ? { ...item, status: recommendation.action === 'ignore' ? 'ignored' as const : 'archived' as const, updatedAt: new Date().toISOString() }
      : item);
    writeInbox(items);
  }
  if (recommendation.target === 'skill') {
    const skills = readSkills().map((skill) => skill.id === recommendation.targetId
      ? { ...skill, status: recommendation.action === 'reject' ? 'rejected' as const : 'archived' as const, updatedAt: new Date().toISOString() }
      : skill);
    writeSkills(skills);
  }
  if (recommendation.target === 'pack') {
    const packs = seedStarterPacks(readPacks()).map((pack) => pack.id === recommendation.targetId
      ? { ...pack, status: 'archived' as const, updatedAt: new Date().toISOString() }
      : pack);
    writePacks(packs);
  }

  return { ok: true, applied: recommendation, report: buildClutterReaperReport() };
}
