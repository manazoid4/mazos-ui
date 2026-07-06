export type Competitor = {
  id: string;
  name: string;
  category: 'workflow' | 'agent-runtime' | 'coding-agent' | 'loop-engineering';
  priority: 'high' | 'medium';
  repo?: string;
  docsUrl: string;
  emulate: string[];
  avoid: string[];
  suggestedLoopPack: string;
};

export type CompetitorSnapshot = {
  competitor: Competitor;
  fetchedAt: string;
  github: {
    fullName: string;
    stars: number;
    forks: number;
    pushedAt: string;
    description: string;
    license: string;
    ok: boolean;
    error?: string;
  } | null;
  patterns: string[];
  mazosGap: string;
  recommendation: 'copy' | 'adapt' | 'ignore';
  evidence: string[];
};

export type CompetitorRadar = {
  generatedAt: string;
  sourceRule: string;
  snapshots: CompetitorSnapshot[];
  matrix: { pattern: string; competitors: string[]; mazosMove: string }[];
  nextAction: string;
};

export const COMPETITORS: Competitor[] = [
  {
    id: 'n8n',
    name: 'n8n',
    category: 'workflow',
    priority: 'high',
    repo: 'n8n-io/n8n',
    docsUrl: 'https://docs.n8n.io/',
    emulate: ['execution history', 'workflow templates', 'trigger catalog', 'node-level debugging'],
    avoid: ['generic blank canvas', 'broad connector marketplace before local loops work'],
    suggestedLoopPack: 'Competitor Intelligence',
  },
  {
    id: 'dify',
    name: 'Dify',
    category: 'workflow',
    priority: 'high',
    repo: 'langgenius/dify',
    docsUrl: 'https://docs.dify.ai/',
    emulate: ['app/workflow packaging', 'logs', 'run history', 'agentic workflow builder'],
    avoid: ['cloud-first app sprawl'],
    suggestedLoopPack: 'Research Intelligence',
  },
  {
    id: 'activepieces',
    name: 'Activepieces',
    category: 'workflow',
    priority: 'medium',
    repo: 'activepieces/activepieces',
    docsUrl: 'https://www.activepieces.com/docs/overview/welcome',
    emulate: ['MCP-aware connectors', 'flow debugging', 'human approval steps'],
    avoid: ['integration count as the main product promise'],
    suggestedLoopPack: 'Connector Policy',
  },
  {
    id: 'langgraph',
    name: 'LangGraph',
    category: 'agent-runtime',
    priority: 'high',
    repo: 'langchain-ai/langgraph',
    docsUrl: 'https://docs.langchain.com/oss/python/langgraph/overview',
    emulate: ['durable state', 'interrupts', 'pause/resume', 'stateful graph execution'],
    avoid: ['framework lock-in before MAZos owns its loop contract'],
    suggestedLoopPack: 'Loop Simulator',
  },
  {
    id: 'openhands',
    name: 'OpenHands',
    category: 'coding-agent',
    priority: 'high',
    repo: 'OpenHands/OpenHands',
    docsUrl: 'https://www.openhands.dev/',
    emulate: ['agent workspace', 'task history', 'file/shell/browser context', 'reviewable artifacts'],
    avoid: ['rebuilding an IDE inside MAZos'],
    suggestedLoopPack: 'Agent Workbench',
  },
  {
    id: 'opencode',
    name: 'opencode',
    category: 'coding-agent',
    priority: 'high',
    repo: 'anomalyco/opencode',
    docsUrl: 'https://opencode.ai/docs/',
    emulate: ['terminal-native sessions', 'agent sharing', 'fast command UX'],
    avoid: ['hiding branch/diff verification'],
    suggestedLoopPack: 'Runtime Export',
  },
  {
    id: 'codex',
    name: 'Codex',
    category: 'coding-agent',
    priority: 'high',
    repo: 'openai/codex',
    docsUrl: 'https://developers.openai.com/codex/',
    emulate: ['worktree tasks', 'automations', 'reviewable coding-agent runs'],
    avoid: ['unreviewed autonomous writes'],
    suggestedLoopPack: 'PR Babysitter',
  },
  {
    id: 'ospec',
    name: 'OSpec',
    category: 'loop-engineering',
    priority: 'medium',
    repo: 'clawplays/ospec',
    docsUrl: 'https://github.com/clawplays/ospec',
    emulate: ['spec-plan-act-verify', 'evidence in repo', 'safety levels'],
    avoid: ['spec ceremony without product outcome'],
    suggestedLoopPack: 'Useless Feature Reaper',
  },
];

function repoUrl(repo: string) {
  return `https://github.com/${repo}`;
}

async function githubSnapshot(repo: string) {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'mazos-competitor-radar' },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    const json = await res.json();
    return {
      fullName: String(json.full_name || repo),
      stars: Number(json.stargazers_count || 0),
      forks: Number(json.forks_count || 0),
      pushedAt: String(json.pushed_at || ''),
      description: String(json.description || ''),
      license: String(json.license?.spdx_id || 'NOASSERTION'),
      ok: true,
    };
  } catch (error) {
    return {
      fullName: repo,
      stars: 0,
      forks: 0,
      pushedAt: '',
      description: '',
      license: 'unknown',
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function recommendationFor(competitor: Competitor): CompetitorSnapshot['recommendation'] {
  if (competitor.priority === 'high') return 'adapt';
  return competitor.category === 'loop-engineering' ? 'copy' : 'adapt';
}

function gapFor(competitor: Competitor) {
  if (competitor.category === 'workflow') return 'MAZos needs stronger run debugging, templates, and connector policy around local-first loops.';
  if (competitor.category === 'agent-runtime') return 'MAZos needs a clearer durable loop state machine before stronger automation.';
  if (competitor.category === 'coding-agent') return 'MAZos needs an Agent Workbench layer above coding tools, not another editor.';
  return 'MAZos needs repo-backed specs and evidence without adding process bloat.';
}

export async function buildCompetitorRadar(): Promise<CompetitorRadar> {
  const snapshots = await Promise.all(COMPETITORS.map(async (competitor): Promise<CompetitorSnapshot> => {
    const github = competitor.repo ? await githubSnapshot(competitor.repo) : null;
    return {
      competitor,
      fetchedAt: new Date().toISOString(),
      github,
      patterns: competitor.emulate,
      mazosGap: gapFor(competitor),
      recommendation: recommendationFor(competitor),
      evidence: [competitor.docsUrl, ...(competitor.repo ? [repoUrl(competitor.repo)] : [])],
    };
  }));

  return {
    generatedAt: new Date().toISOString(),
    sourceRule: 'Use latest GitHub pushed_at/stars/forks plus official docs URLs before deciding what to emulate.',
    snapshots,
    matrix: [
      { pattern: 'Execution/run history', competitors: ['n8n', 'Dify', 'Activepieces'], mazosMove: 'Upgrade Loop Receipts into a visual Run Inspector.' },
      { pattern: 'Durable pause/resume state', competitors: ['LangGraph', 'Temporal'], mazosMove: 'Add a Loop State Machine with approval/checkpoint states.' },
      { pattern: 'Agent workbench', competitors: ['OpenHands', 'opencode', 'Codex', 'Cline'], mazosMove: 'Add runtime picker, context receipts, launch prompts, and run comparison.' },
      { pattern: 'Spec/evidence loops', competitors: ['OSpec', 'loop-engineering'], mazosMove: 'Store loop specs and evidence receipts as repo/vault artifacts.' },
    ],
    nextAction: 'Build a read-only Run Inspector from Loop Receipts, then add GitHub Pulse snapshots to each competitor and project loop.',
  };
}
