// Decision Inbox: "stop and ask" human gates. Loops and intake file questions here;
// the human resolves them and hands the agent a resolution prompt.
// Pure module — client-safe. Persistence lives in the /api/mazos/decisions route.

export type DecisionStatus = 'open' | 'approved' | 'denied' | 'answered';

export type DecisionEvent = {
  id: string;
  at: string;
  type: 'open' | 'resolve';
  // open fields
  source?: string;             // loop id, 'handoff', 'intake', or 'manual'
  question?: string;
  context?: string;
  options?: string[];
  // resolve fields
  status?: Exclude<DecisionStatus, 'open'>;
  resolution?: string;
};

export type DecisionItem = {
  id: string;
  createdAt: string;
  source: string;
  question: string;
  context: string;
  options: string[];
  status: DecisionStatus;
  resolution: string;
  resolvedAt: string | null;
};

// State derived from the append-only event log: last resolve per id wins.
export function foldDecisions(events: DecisionEvent[]): DecisionItem[] {
  const items = new Map<string, DecisionItem>();
  for (const e of events) {
    if (e.type === 'open') {
      items.set(e.id, { id: e.id, createdAt: e.at, source: e.source || 'manual', question: e.question || '', context: e.context || '', options: e.options || ['approve', 'deny'], status: 'open', resolution: '', resolvedAt: null });
    } else if (e.type === 'resolve') {
      const item = items.get(e.id);
      if (item) { item.status = e.status || 'answered'; item.resolution = e.resolution || ''; item.resolvedAt = e.at; }
    }
  }
  return [...items.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Copyable prompt telling the waiting agent what the human decided.
export function buildResolutionPrompt(item: DecisionItem): string {
  const verdict = item.status === 'approved' ? 'APPROVED — proceed' : item.status === 'denied' ? 'DENIED — do not proceed' : 'ANSWERED';
  return [
    `Human gate resolved for ${item.source}.`,
    ``,
    `QUESTION: ${item.question}`,
    item.context ? `CONTEXT: ${item.context}` : '',
    `DECISION: ${verdict}`,
    item.resolution ? `DETAIL: ${item.resolution}` : '',
    ``,
    `Resume the loop from where it gated. Stay within the original safety ceiling and stop conditions. This resolution covers only the question above — gate again for anything new.`,
  ].filter(Boolean).join('\n');
}
