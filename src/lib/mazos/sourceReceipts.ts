import path from 'path';
import { latestProjectStatus } from './projectStatus';
import { getOpenWikiStatus } from './openWiki';
import { routeTask } from './toolRouter';

export type SourceReceiptKind = 'repo' | 'vault' | 'openwiki' | 'api' | 'tool' | 'command' | 'doc';

export type SourceReceipt = {
  title: string;
  kind: SourceReceiptKind;
  pathOrUrl: string;
  freshness: string;
  confidence: 'high' | 'medium' | 'low';
  readFirst: boolean;
  sensitive: boolean;
  product?: string;
};

export type ContextMap = {
  generatedAt: string;
  project: string;
  repoPath: string | null;
  blocker: string;
  nextBestAction: string;
  receipts: SourceReceipt[];
  missingKnowledge: string[];
  copyPrompt: string;
};

function isSensitive(pathOrUrl: string) {
  const lower = pathOrUrl.toLowerCase();
  return lower.includes('/users/manaz/') || lower.includes('c:/users/manaz/') || lower.includes('obsidian') || lower.includes('vault');
}

function freshnessFromIso(iso?: string | null) {
  if (!iso) return 'unknown';
  const hours = (Date.now() - new Date(iso).getTime()) / 36e5;
  if (!Number.isFinite(hours)) return 'unknown';
  if (hours < 24) return 'fresh today';
  if (hours < 72) return 'fresh this week';
  return 'stale';
}

function receipt(input: Omit<SourceReceipt, 'sensitive'> & { sensitive?: boolean }): SourceReceipt {
  return { ...input, sensitive: input.sensitive ?? isSensitive(input.pathOrUrl) };
}

function uniqueReceipts(receipts: SourceReceipt[]) {
  const seen = new Set<string>();
  return receipts.filter((item) => {
    const key = `${item.kind}:${item.pathOrUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildContextMap(project: string): ContextMap {
  const status = latestProjectStatus(project);
  const resolvedProject = status.matchedProject || project;
  const receipts: SourceReceipt[] = [];

  if (status.resolvedRepoPath) {
    receipts.push(receipt({
      title: `${resolvedProject} repository`,
      kind: 'repo',
      pathOrUrl: status.resolvedRepoPath,
      freshness: freshnessFromIso(status.latestCommit?.split(' ').slice(1, 3).join(' ')),
      confidence: status.gitStatus.length ? 'medium' : 'high',
      readFirst: true,
      product: resolvedProject,
    }));
  }

  for (const sourcePath of status.evidencePathsRead.slice(0, 8)) {
    const ext = path.extname(sourcePath).toLowerCase();
    receipts.push(receipt({
      title: path.basename(sourcePath) || sourcePath,
      kind: sourcePath.includes('Obsidian') || sourcePath.includes('claude-obsidian') ? 'vault' : ext === '.md' ? 'doc' : 'repo',
      pathOrUrl: sourcePath,
      freshness: 'read by MAZos project status',
      confidence: 'medium',
      readFirst: true,
      product: resolvedProject,
    }));
  }

  for (const command of status.verifyCommands.slice(0, 4)) {
    receipts.push(receipt({
      title: command,
      kind: 'command',
      pathOrUrl: status.resolvedRepoPath || resolvedProject,
      freshness: 'run before handoff',
      confidence: 'high',
      readFirst: false,
      product: resolvedProject,
    }));
  }

  try {
    const openwiki = getOpenWikiStatus();
    receipts.push(receipt({
      title: 'OpenWiki local database',
      kind: 'openwiki',
      pathOrUrl: openwiki.paths.db,
      freshness: `${openwiki.counts.wikiPages} wiki page(s), ${openwiki.counts.capturedContent} capture(s)`,
      confidence: openwiki.counts.wikiPages > 0 ? 'medium' : 'low',
      readFirst: false,
      product: 'OpenWiki',
    }));
    for (const page of openwiki.latestPages.slice(0, 3)) {
      receipts.push(receipt({
        title: page.title,
        kind: 'openwiki',
        pathOrUrl: openwiki.paths.db,
        freshness: page.updatedAt || 'latest OpenWiki page',
        confidence: 'medium',
        readFirst: false,
        product: 'OpenWiki',
      }));
    }
  } catch {
    receipts.push(receipt({
      title: 'OpenWiki unavailable',
      kind: 'openwiki',
      pathOrUrl: 'GET /api/mazos/openwiki',
      freshness: 'unavailable',
      confidence: 'low',
      readFirst: false,
      product: 'OpenWiki',
      sensitive: false,
    }));
  }

  for (const tool of routeTask(`${project} ${status.nextBestAction}`, 3)) {
    receipts.push(receipt({
      title: tool.name,
      kind: 'tool',
      pathOrUrl: `${tool.localPath}/${tool.readFirst}`,
      freshness: `matched ${tool.matched.join(', ') || 'name/direct'}`,
      confidence: tool.score >= 2 ? 'high' : 'medium',
      readFirst: true,
      product: resolvedProject,
      sensitive: false,
    }));
  }

  const missingKnowledge = [
    ...status.missing,
    status.evidencePathsRead.length === 0 ? 'No vault/current evidence paths were read for this project.' : '',
    !status.resolvedRepoPath ? 'No resolved repo path; agent prompts will be weaker.' : '',
  ].filter(Boolean);

  const finalReceipts = uniqueReceipts(receipts).slice(0, 18);
  const copyPrompt = [
    `Use this MAZos Context Map before acting on ${resolvedProject}.`,
    ``,
    `PROJECT: ${resolvedProject}`,
    `REPO: ${status.resolvedRepoPath || 'unresolved'}`,
    `BLOCKER: ${status.blocker}`,
    `NEXT BEST ACTION: ${status.nextBestAction}`,
    ``,
    `READ FIRST:`,
    ...finalReceipts.filter((item) => item.readFirst).slice(0, 8).map((item) => `- [${item.kind}] ${item.title}: ${item.pathOrUrl}`),
    ``,
    `VERIFY WITH:`,
    ...(status.verifyCommands.length ? status.verifyCommands : ['git status --short']).map((command) => `- ${command}`),
    ``,
    `RULES: quote evidence, do not invent context, stop if receipts contradict the task.`,
  ].join('\n');

  return {
    generatedAt: new Date().toISOString(),
    project: resolvedProject,
    repoPath: status.resolvedRepoPath,
    blocker: status.blocker,
    nextBestAction: status.nextBestAction,
    receipts: finalReceipts,
    missingKnowledge,
    copyPrompt,
  };
}
