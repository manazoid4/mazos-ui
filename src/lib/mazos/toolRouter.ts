// Tool router: given the task at hand, recommend which installed source/tool to consult
// and explain why in one line. Registry mirrors external/agent-sources submodules and the
// Hermes external-source registry. Pure module — safe to import client-side.

import type { SafetyLevel } from './safety';

export type SourceKind = 'pattern' | 'automation' | 'skill' | 'product' | 'discipline';

export type ToolSource = {
  id: string;
  name: string;
  kind: SourceKind;
  localPath: string;      // MAZos submodule pointer
  useWhen: string;        // one-line "why consult this"
  keywords: string[];     // task keywords that route here
  safety: SafetyLevel;    // ceiling to respect when acting on its guidance
  readFirst: string;      // file to read before acting
};

const SUB = 'external/agent-sources';

export const TOOL_SOURCES: ToolSource[] = [
  { id: 'headroom', name: 'Headroom', kind: 'pattern', localPath: `${SUB}/headroom`,
    useWhen: 'Meeting/async collaboration + context compression and shared cross-agent memory.',
    keywords: ['meeting', 'async', 'collaborat', 'context', 'compress', 'token', 'memory', 'handoff', 'summar'],
    safety: 'L1', readFirst: 'README.md' },
  { id: 'agent-reach', name: 'Agent Reach', kind: 'pattern', localPath: `${SUB}/agent-reach`,
    useWhen: 'Outreach + agent communication: webpages, YouTube, RSS, GitHub, social with consent boundaries.',
    keywords: ['outreach', 'reach', 'web', 'youtube', 'rss', 'reddit', 'twitter', ' x ', 'instagram', 'contact', 'email', 'scrape', 'research'],
    safety: 'L4', readFirst: 'README.md' },
  { id: 'nvidia-skills', name: 'NVIDIA Skills', kind: 'skill', localPath: `${SUB}/nvidia-skills`,
    useWhen: 'Skill routing / agent capability design, verified-skill governance, GPU/RAG blueprints.',
    keywords: ['skill', 'route', 'capability', 'gpu', 'cuda', 'nemo', 'rag', 'governance', 'agent design'],
    safety: 'L1', readFirst: 'skills' },
  { id: 'claude-skills', name: 'Claude Skills', kind: 'skill', localPath: `${SUB}/claude-skills`,
    useWhen: 'Skill routing and reusable agent workflow/role patterns for MAZos agents.',
    keywords: ['skill', 'workflow', 'role', 'agent', 'command', 'pattern', 'reusable'],
    safety: 'L1', readFirst: 'README.md' },
  { id: 'maxun', name: 'Maxun', kind: 'automation', localPath: `${SUB}/maxun`,
    useWhen: 'Browser automation / workflow extraction — ToS-safe scraping architecture.',
    keywords: ['browser', 'automat', 'extract', 'scrape', 'workflow extract', 'crawl', 'data collect'],
    safety: 'L4', readFirst: 'README.md' },
  { id: 'loop-engineering', name: 'Loop Engineering', kind: 'discipline', localPath: `${SUB}/loop-engineering`,
    useWhen: 'Loop / RALPH operating discipline: stop conditions, budgets, run logs, human gates.',
    keywords: ['loop', 'ralph', 'recurring', 'monitor', 'babysit', 'triage', 'sweep', 'autonomous', 'schedule', 'budget', 'stop condition'],
    safety: 'L1', readFirst: 'README.md' },
  { id: 'awesome-n8n-templates', name: 'awesome-n8n-templates', kind: 'automation', localPath: `${SUB}/awesome-n8n-templates`,
    useWhen: 'Workflow automation templates / no-code blueprint inspiration (read the category first).',
    keywords: ['n8n', 'template', 'no-code', 'nocode', 'webhook', 'integration', 'automation', 'zapier', 'blueprint'],
    safety: 'L1', readFirst: 'README.md' },
  { id: 'n8n', name: 'n8n', kind: 'automation', localPath: `${SUB}/n8n`,
    useWhen: 'Workflow automation engine internals when building real automations, not just templates.',
    keywords: ['n8n', 'automation engine', 'node', 'trigger', 'integration', 'workflow'],
    safety: 'L1', readFirst: 'README.md' },
  { id: 'cal-com', name: 'Cal.com', kind: 'product', localPath: `${SUB}/cal-com`,
    useWhen: 'Scheduling / booking capability reference.',
    keywords: ['schedul', 'booking', 'calendar', 'availability', 'appointment'],
    safety: 'L1', readFirst: 'README.md' },
  { id: 'plausible-analytics', name: 'Plausible', kind: 'product', localPath: `${SUB}/plausible-analytics`,
    useWhen: 'Privacy-first analytics / metrics capability reference.',
    keywords: ['analytic', 'metric', 'tracking', 'stats', 'dashboard', 'conversion'],
    safety: 'L1', readFirst: 'README.md' },
  { id: 'ghost', name: 'Ghost', kind: 'product', localPath: `${SUB}/ghost`,
    useWhen: 'Publishing / newsletter / content site capability reference.',
    keywords: ['publish', 'blog', 'newsletter', 'content site', 'cms', 'membership'],
    safety: 'L1', readFirst: 'README.md' },
  { id: 'supabase', name: 'Supabase', kind: 'product', localPath: `${SUB}/supabase`,
    useWhen: 'Postgres / auth / storage / realtime backend capability reference.',
    keywords: ['supabase', 'postgres', 'database', 'auth', 'storage', 'realtime', 'backend', 'rls'],
    safety: 'L1', readFirst: 'README.md' },
  { id: 'medusa', name: 'Medusa', kind: 'product', localPath: `${SUB}/medusa`,
    useWhen: 'Commerce / cart / order capability reference.',
    keywords: ['commerce', 'ecommerce', 'cart', 'order', 'payment', 'product catalog', 'store'],
    safety: 'L1', readFirst: 'README.md' },
  { id: 'appflowy', name: 'AppFlowy', kind: 'product', localPath: `${SUB}/appflowy`,
    useWhen: 'Notion-style docs / boards / knowledge workspace capability reference.',
    keywords: ['notion', 'docs', 'board', 'knowledge', 'workspace', 'kanban', 'wiki'],
    safety: 'L1', readFirst: 'README.md' },
  { id: 'coolify', name: 'Coolify', kind: 'product', localPath: `${SUB}/coolify`,
    useWhen: 'Self-host deploy / PaaS capability reference (deploy work is L5).',
    keywords: ['deploy', 'self-host', 'selfhost', 'paas', 'server', 'host', 'docker', 'infra'],
    safety: 'L5', readFirst: 'README.md' },
  { id: 'listmonk', name: 'Listmonk', kind: 'product', localPath: `${SUB}/listmonk`,
    useWhen: 'Bulk email / mailing list capability reference (sending is L4).',
    keywords: ['email', 'mailing', 'list', 'campaign', 'broadcast', 'subscriber'],
    safety: 'L4', readFirst: 'README.md' },
  { id: 'penpot', name: 'Penpot', kind: 'product', localPath: `${SUB}/penpot`,
    useWhen: 'Design / prototyping / UI capability reference.',
    keywords: ['design', 'prototype', 'ui', 'ux', 'figma', 'mockup', 'wireframe'],
    safety: 'L1', readFirst: 'README.md' },
];

export type ToolRecommendation = ToolSource & { score: number; matched: string[] };

export function routeTask(task: string, limit = 3): ToolRecommendation[] {
  const q = ` ${task.toLowerCase()} `;
  return TOOL_SOURCES
    .map(src => {
      const matched = src.keywords.filter(k => q.includes(k.toLowerCase()));
      // name hit is a strong signal
      const nameHit = q.includes(src.name.toLowerCase()) ? 2 : 0;
      return { ...src, score: matched.length + nameHit, matched };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
