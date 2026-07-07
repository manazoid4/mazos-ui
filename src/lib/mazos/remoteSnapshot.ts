import { buildCompetitorRadar } from './competitorRadar';
import { allLoopTemplates, auditLoopUsefulness } from './loopFactory';
import { readLoopReceipts } from './loopReceipts';
import { readResearchConsole } from './research';
import { sanitizeForRemote, type RedactionReport } from './remoteSanitize';

export type RemoteSnapshot = {
  generatedAt: string;
  mode: 'remote-safe' | 'local-safe';
  privacy: {
    includesLocalPaths: false;
    includesSystemInfo: false;
    includesSecrets: false;
    note: string;
  };
  redactionReport: RedactionReport;
  research: {
    metrics: ReturnType<typeof readResearchConsole>['metrics'];
    prompts: ReturnType<typeof readResearchConsole>['roadmap']['prompts'];
    nextSteps: ReturnType<typeof readResearchConsole>['roadmap']['nextSteps'];
    nextBuildQueue: string[];
  };
  competitorRadar: Awaited<ReturnType<typeof buildCompetitorRadar>>;
  loops: {
    id: string;
    name: string;
    agent: string;
    safetyCeiling: string;
    score: number;
    decision: string;
    receiptCount: number;
    latestReceiptAt: string | null;
    latestReceiptStatus: string | null;
  }[];
  mobileNext: {
    priority: number;
    title: string;
    summary: string;
    snapshotFeed: string[];
  }[];
  nextAction: string;
};

export async function buildRemoteSnapshot(): Promise<RemoteSnapshot> {
  const research = readResearchConsole();
  const competitorRadar = await buildCompetitorRadar();
  const receipts = readLoopReceipts(200);
  const loops = allLoopTemplates().map((loop) => {
    const audit = auditLoopUsefulness(loop);
    const loopReceipts = receipts.filter((receipt) => receipt.loopId === loop.id);
    const latestReceipt = loopReceipts[0] || null;
    return {
      id: loop.id,
      name: loop.name,
      agent: loop.agent,
      safetyCeiling: loop.safetyCeiling,
      score: audit.score,
      decision: audit.decision,
      receiptCount: loopReceipts.length,
      latestReceiptAt: latestReceipt?.createdAt || null,
      latestReceiptStatus: latestReceipt?.status || null,
    };
  });

  const snapshot: RemoteSnapshot = {
    generatedAt: new Date().toISOString(),
    mode: process.env.VERCEL ? 'remote-safe' : 'local-safe',
    privacy: {
      includesLocalPaths: false,
      includesSystemInfo: false,
      includesSecrets: false,
      note: 'This snapshot intentionally excludes Windows paths, system telemetry, raw vault content, secrets, and unredacted local files. Use localhost for full local cockpit access.',
    },
    research: {
      metrics: research.metrics,
      prompts: research.roadmap.prompts,
      nextSteps: research.roadmap.nextSteps,
      nextBuildQueue: research.nextBuildQueue,
    },
    competitorRadar,
    loops,
    mobileNext: [
      {
        priority: 1,
        title: 'Run Inspector',
        summary: 'Turn Loop Receipts into the primary loop timeline: trigger, sources, findings, gate, action, and next-run suggestion.',
        snapshotFeed: ['latest active run', 'blocked gate', 'top finding', 'next action', 'evidence freshness'],
      },
      {
        priority: 2,
        title: 'Loop Inbox',
        summary: 'Normalize research, radar, and loop outputs into one accept/defer/dismiss decision queue.',
        snapshotFeed: ['top 3 decisions', 'overdue gates', 'project labels', 'one-tap state changes'],
      },
      {
        priority: 3,
        title: 'Cadence Controller',
        summary: 'Show due, stale, useful, and retired loops so MAZos becomes an operating rhythm.',
        snapshotFeed: ['due loops', 'stale loops', 'stopped loops', 'last useful receipt', 'next scheduled check'],
      },
    ],
    nextAction: 'Build Run Inspector next. Use this endpoint from Codex Mobile/Vercel for safe MAZos context. Use localhost only when local files/system data are needed.',
    redactionReport: { redactions: 0, rules: {} },
  };

  const sanitized = sanitizeForRemote(snapshot);
  sanitized.value.redactionReport = sanitized.report;
  return sanitized.value;
}
