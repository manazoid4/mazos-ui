import { buildFeed } from './feed';
import { buildContextMap } from './sourceReceipts';
import { buildSummary, readInbox } from './aiSourceInbox';
import { buildSkillSummary, readSkills } from './skillFactory';

export type MorningBrief = {
  generatedAt: string;
  headline: string;
  shipNext: string;
  needsYou: string[];
  avoidToday: string;
  safestNextPrompt: string;
  evidence: string[];
  markdown: string;
  degraded: boolean;
  warnings: string[];
  aiInbox: {
    newCount: number;
    topSkillCandidate: string | null;
    topLoopCandidate: string | null;
    recommendedAction: string;
  };
  trust: {
    untrustedCount: number;
    topRiskySkill: string | null;
    topLowValueItem: string | null;
    cleanupAction: string;
  };
};

export async function buildMorningBrief(project = 'MAZos'): Promise<MorningBrief> {
  const feed = await buildFeed({ limit: 30 });
  const context = buildContextMap(project);
  const inboxItems = readInbox();
  const inbox = buildSummary(inboxItems);
  const skillSummary = buildSkillSummary(readSkills());
  const untrusted = inboxItems.filter((item) => item.trustScore < 40);
  const lowValue = inboxItems.filter((item) => item.usefulnessScore < 35 && item.status === 'new').sort((a, b) => a.usefulnessScore - b.usefulnessScore)[0] || null;
  const riskySkill = skillSummary.topCandidates.find((skill) => skill.riskLevel === 'high' || skill.trustScore < 40) || null;
  const live = feed.items.filter((item) => item.userState !== 'done' && item.userState !== 'cleared');
  const top = live[0];
  const ship = live.find((item) => item.type === 'shipping-spine') || top;
  const blocked = live.filter((item) => item.requiresAttention).slice(0, 5);
  const ignore = [...feed.items].reverse().find((item) => !item.requiresAttention && item.userState !== 'saved');
  // One Verdict: the spine handoff prompt is the safest next prompt; the
  // generic top-item prompt is a fallback, not a competitor.
  const prompt = ship?.copyPrompt || top?.copyPrompt || context.copyPrompt;
  const needsYou = blocked.length
    ? blocked.map((item) => `${item.lane}: ${item.title}`)
    : ['No urgent human gate in the current feed.'];
  const evidence = [
    'GET /api/mazos/feed',
    'GET /api/mazos/context-map',
    ...context.receipts.filter((item) => item.readFirst).slice(0, 5).map((item) => item.pathOrUrl),
  ];

  const brief = {
    generatedAt: new Date().toISOString(),
    headline: ship ? ship.title : 'No feed signals found.',
    shipNext: ship ? `${ship.product || 'MAZos'}: ${ship.nextAction}` : context.nextBestAction,
    needsYou,
    avoidToday: ignore ? `Ignore unless contradicted: ${ignore.title}` : 'Do not start broad new work until the current spine item is handled.',
    safestNextPrompt: prompt,
    evidence,
    degraded: feed.degraded,
    warnings: feed.warnings,
    aiInbox: {
      newCount: inbox.countsByStatus.new || 0,
      topSkillCandidate: inbox.topSkillCandidate?.title || null,
      topLoopCandidate: inbox.topLoopCandidate?.title || null,
      recommendedAction: inbox.recommendedNextAction,
    },
    trust: {
      untrustedCount: untrusted.length,
      topRiskySkill: riskySkill?.name || null,
      topLowValueItem: lowValue?.title || null,
      cleanupAction: lowValue ? `Archive or ignore low-value source: ${lowValue.title}` : 'No low-value AI source cleanup needed.',
    },
  };
  const markdown = [
    `# MAZos Morning Command Brief`,
    `Generated: ${brief.generatedAt}`,
    ``,
    `## Headline`,
    brief.headline,
    ``,
    `## Ship Next`,
    brief.shipNext,
    ``,
    `## Needs Maz`,
    ...brief.needsYou.map((item) => `- ${item}`),
    ``,
    `## AI Source Inbox`,
    `- New sources: ${brief.aiInbox.newCount}`,
    `- Top skill candidate: ${brief.aiInbox.topSkillCandidate || 'none'}`,
    `- Top loop candidate: ${brief.aiInbox.topLoopCandidate || 'none'}`,
    `- Recommended action: ${brief.aiInbox.recommendedAction}`,
    ``,
    `## Trust / Cleanup`,
    `- Untrusted source count: ${brief.trust.untrustedCount}`,
    `- Risky skill: ${brief.trust.topRiskySkill || 'none'}`,
    `- Low-value item: ${brief.trust.topLowValueItem || 'none'}`,
    `- Cleanup action: ${brief.trust.cleanupAction}`,
    ``,
    `## Avoid Today`,
    brief.avoidToday,
    ``,
    `## Evidence`,
    ...brief.evidence.map((item) => `- ${item}`),
    ``,
    `## Safest Next Prompt`,
    '```text',
    brief.safestNextPrompt,
    '```',
  ].join('\n');

  return { ...brief, markdown };
}
