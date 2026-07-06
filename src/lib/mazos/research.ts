import fs from 'fs';
import path from 'path';
import { RESEARCH_DIR } from './paths';

export type ResearchReport = {
  id: string;
  title: string;
  file: string;
  path: string;
  updatedAt: string;
  size: number;
  track: string;
  question: string;
  summary: string;
  sections: string[];
  sources: string[];
  nextActions: string[];
  usefulness: 'build-now' | 'reference' | 'audit' | 'archive';
};

export type ResearchConsole = {
  generatedAt: string;
  directory: string;
  reports: ResearchReport[];
  roadmap: ResearchRoadmap;
  metrics: {
    totalReports: number;
    deepResearchReports: number;
    sourceCount: number;
    buildNowCount: number;
    auditCount: number;
  };
  nextBuildQueue: string[];
  automationPrompt: string;
};

export type ResearchPrompt = {
  id: string;
  title: string;
  goal: string;
  sources: string[];
  deliverable: string;
  whyItMatters: string;
};

export type RoadmapItem = {
  id: string;
  title: string;
  competitorPattern: string;
  repoNextStep: string;
  priority: 'now' | 'next' | 'later';
};

export type ResearchRoadmap = {
  prompts: ResearchPrompt[];
  nextSteps: RoadmapItem[];
  implementationFocus: string;
};

const REPORT_PREFIXES = ['DEEP_RESEARCH_', 'MULTI_DEEP_RESEARCH_', 'LOOP_FACTORY_PRODUCT_LINE_RESEARCH_'];

function lines(markdown: string) {
  return markdown.split(/\r?\n/);
}

function firstMatch(markdown: string, regex: RegExp, fallback = '') {
  return markdown.match(regex)?.[1]?.trim() || fallback;
}

function titleFor(markdown: string, file: string) {
  return firstMatch(markdown, /^#\s+(.+)$/m, file.replace(/_/g, ' ').replace(/\.md$/i, ''));
}

function sectionNames(markdown: string) {
  return lines(markdown)
    .filter((line) => /^##\s+[^#]/.test(line))
    .map((line) => line.replace(/^##\s+/, '').trim())
    .slice(0, 10);
}

function bulletBlockAfter(markdown: string, heading: string, limit = 8) {
  const all = lines(markdown);
  const start = all.findIndex((line) => line.trim().toLowerCase() === heading.toLowerCase());
  if (start < 0) return [];
  const out: string[] = [];
  for (const line of all.slice(start + 1)) {
    if (/^##\s+/.test(line)) break;
    const item = line.match(/^\s*[-*]\s+(.+)$/)?.[1]?.trim();
    if (item) out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

function extractUrls(markdown: string) {
  const found = markdown.match(/https?:\/\/[^\s)]+/g) || [];
  return Array.from(new Set(found.map((url) => url.replace(/[.,;]+$/, '')))).slice(0, 18);
}

function paragraphAfter(markdown: string, heading: string) {
  const all = lines(markdown);
  const start = all.findIndex((line) => line.trim().toLowerCase() === heading.toLowerCase());
  if (start < 0) return '';
  const chunks: string[] = [];
  for (const line of all.slice(start + 1)) {
    if (/^##\s+/.test(line)) break;
    const clean = line.trim();
    if (!clean || clean.startsWith('|') || clean.startsWith('- ')) continue;
    chunks.push(clean);
    if (chunks.join(' ').length > 260) break;
  }
  return chunks.join(' ').slice(0, 320);
}

function classify(file: string, title: string): ResearchReport['usefulness'] {
  const text = `${file} ${title}`.toLowerCase();
  if (text.includes('usefulness') || text.includes('audit')) return 'audit';
  if (text.includes('index') || text.includes('product_line') || text.includes('loop_factory')) return 'build-now';
  if (text.includes('deep_research')) return 'build-now';
  return 'reference';
}

function trackFor(file: string, title: string) {
  const text = `${file} ${title}`.toLowerCase();
  if (text.includes('workflow')) return 'Workflow automation';
  if (text.includes('runtime') || text.includes('loop_engineering')) return 'Agent runtime';
  if (text.includes('coding_agent')) return 'Coding agents';
  if (text.includes('usefulness') || text.includes('audit')) return 'Usefulness audit';
  if (text.includes('loop_factory')) return 'Loop Factory';
  return 'Research';
}

function fallbackSummary(markdown: string) {
  return paragraphAfter(markdown, '## Executive Synthesis')
    || paragraphAfter(markdown, '## Product-Level Diagnosis')
    || paragraphAfter(markdown, '## Best-Practice Synthesis')
    || paragraphAfter(markdown, '## Question')
    || lines(markdown).find((line) => line.trim() && !line.startsWith('#'))?.trim()
    || 'Saved MAZos research report.';
}

export const RESEARCH_ROADMAP: ResearchRoadmap = {
  implementationFocus: 'Build Competitor Radar next: live competitor snapshots, feature matrix, copy/adapt/ignore recommendations, and Draft Loop Pack handoff.',
  prompts: [
    {
      id: 'workflow-builder-emulation',
      title: 'Workflow Builder Emulation',
      goal: 'Identify the highest-leverage workflow automation features MAZos should emulate without becoming a generic node canvas.',
      sources: ['n8n', 'Dify', 'Activepieces', 'GitHub Actions', 'Make', 'Zapier', 'Gumloop'],
      deliverable: 'A MAZos workflow feature matrix covering triggers, execution history, artifacts, credentials/source policy, retries, subflows, and visual density.',
      whyItMatters: 'This decides how MAZos should package loops as repeatable workflows instead of loose prompts.',
    },
    {
      id: 'agent-runtime-durability',
      title: 'Agent Runtime Durability',
      goal: 'Research how production agent systems preserve state, human interrupts, traces, and resumable execution.',
      sources: ['LangGraph', 'Temporal', 'OpenAI Agents SDK', 'AutoGen', 'CrewAI', 'Mastra', 'OSpec'],
      deliverable: 'A LoopSpec v2 design with state, receipts, interrupt states, verifier roles, budgets, and recovery semantics.',
      whyItMatters: 'This keeps MAZos safe and debuggable as loops become more capable.',
    },
    {
      id: 'coding-agent-command-ux',
      title: 'Coding Agent Command UX',
      goal: 'Map the UX patterns from modern coding agents that MAZos should emulate as a cockpit layer.',
      sources: ['OpenHands', 'opencode', 'Codex', 'Cline', 'Continue', 'Aider', 'Cursor', 'Devin', 'Replit Agent'],
      deliverable: 'A command UX brief for task launch, branch/worktree planning, diff review, verification output, and handoff receipts.',
      whyItMatters: 'MAZos should make agents easier to steer and verify, not replace the IDE or terminal.',
    },
    {
      id: 'product-cleanup-revenue-loops',
      title: 'Product Cleanup And Revenue Loops',
      goal: 'Research how MAZos can continuously remove useless surfaces and push revenue-facing work forward across projects.',
      sources: ['MAZos Loop Doctor', 'JobFilter competitors', 'pricing pages', 'Stripe/onboarding docs', 'growth dashboards', 'support inbox patterns'],
      deliverable: 'A loop pack roadmap for Useless Feature Reaper, Revenue Radar, Founder Inbox, and Competitor Intelligence with scoring rules.',
      whyItMatters: 'This prevents dashboard bloat and keeps MAZos tied to shipping, lead quality, and money outcomes.',
    },
  ],
  nextSteps: [
    {
      id: 'github-pulse-api',
      title: 'Competitor Radar Snapshot API',
      competitorPattern: 'GitHub Actions/n8n execution panels: current repo events before action.',
      repoNextStep: 'Add a local API that returns competitor repo/docs signals, product patterns, MAZos gaps, suggested loop pack, and evidence links.',
      priority: 'now',
    },
    {
      id: 'loop-simulator',
      title: 'Loop Simulator',
      competitorPattern: 'Workflow dry runs and agent plan previews.',
      repoNextStep: 'Preview sources, commands, touched files, risk, gates, receipt shape, and expected cost before running a loop.',
      priority: 'next',
    },
    {
      id: 'receipt-viewer',
      title: 'Receipt Viewer',
      competitorPattern: 'Tracing and run artifacts from n8n, OpenAI Agents, OpenHands, and Temporal histories.',
      repoNextStep: 'Replace raw JSON receipt modal with a focused receipt timeline panel.',
      priority: 'next',
    },
    {
      id: 'connector-policy',
      title: 'Connector Policy Layer',
      competitorPattern: 'Activepieces/n8n connector catalogs with permissions.',
      repoNextStep: 'Define allowed connectors, source trust, auth boundaries, and read/write safety per loop pack.',
      priority: 'later',
    },
  ],
};

export function readResearchConsole(): ResearchConsole {
  const reports = fs.existsSync(RESEARCH_DIR)
    ? fs.readdirSync(RESEARCH_DIR)
      .filter((file) => file.endsWith('.md') && REPORT_PREFIXES.some((prefix) => file.startsWith(prefix)))
      .map((file): ResearchReport | null => {
        const fullPath = path.join(RESEARCH_DIR, file);
        try {
          const stat = fs.statSync(fullPath);
          const markdown = fs.readFileSync(fullPath, 'utf8');
          const title = titleFor(markdown, file);
          const nextActions = [
            ...bulletBlockAfter(markdown, '## Concrete Next Build Order'),
            ...bulletBlockAfter(markdown, '## Recommended Next Build Order'),
            ...bulletBlockAfter(markdown, '## Next Implementation PR'),
            ...bulletBlockAfter(markdown, '## Product Features To Build'),
            ...bulletBlockAfter(markdown, '## Recommended Next PRs'),
          ].slice(0, 8);
          return {
            id: file.replace(/\.md$/i, '').toLowerCase(),
            title,
            file,
            path: fullPath,
            updatedAt: stat.mtime.toISOString(),
            size: stat.size,
            track: trackFor(file, title),
            question: paragraphAfter(markdown, '## Question') || 'What should MAZos do next from this research?',
            summary: fallbackSummary(markdown),
            sections: sectionNames(markdown),
            sources: extractUrls(markdown),
            nextActions,
            usefulness: classify(file, title),
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean) as ResearchReport[]
    : [];

  reports.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const sourceCount = new Set(reports.flatMap((report) => report.sources)).size;
  const nextBuildQueue = Array.from(new Set(reports.flatMap((report) => report.nextActions))).slice(0, 10);
  const automationPrompt = [
    'Run the MAZos research cleanup loop.',
    '',
    `READ FIRST: ${path.join(RESEARCH_DIR, 'MULTI_DEEP_RESEARCH_INDEX_2026-07-06.md')}`,
    'Then read the newest deep research reports under research/mazos.',
    '',
    'Return:',
    '1. Which report changed the product direction.',
    '2. Which recommendation is now obsolete or unsupported.',
    '3. The next implementation PR, with exact files likely touched.',
    '4. Source freshness gaps, especially GitHub repos without latest pushed_at.',
    '5. A keep/revise/remove decision for any MAZos surface mentioned.',
    '',
    'Do not implement. Produce a receipt-backed cleanup plan.',
  ].join('\n');

  return {
    generatedAt: new Date().toISOString(),
    directory: RESEARCH_DIR,
    reports,
    roadmap: RESEARCH_ROADMAP,
    metrics: {
      totalReports: reports.length,
      deepResearchReports: reports.filter((report) => report.file.startsWith('DEEP_RESEARCH_')).length,
      sourceCount,
      buildNowCount: reports.filter((report) => report.usefulness === 'build-now').length,
      auditCount: reports.filter((report) => report.usefulness === 'audit').length,
    },
    nextBuildQueue,
    automationPrompt,
  };
}
