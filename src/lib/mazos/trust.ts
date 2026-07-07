// Trust layer: one deterministic scorer for sources, skills, loops, and packs.
// Every item must answer: where from, why useful, tested, evidence, risks,
// and keep/revise/merge/remove/archive/ignore.

export type TrustLevel = 'untrusted' | 'promising' | 'verified' | 'approved';

export type TrustFactors = {
  sourceClarity: boolean;      // known origin: URL or explicit local explanation
  usefulness: number;          // 0-100 usefulness score of the item
  testable: boolean;           // a concrete test plan or verify command exists
  hasEvidence: boolean;        // receipts, test output, or proof links present
  safetyRisk: 'low' | 'medium' | 'high';
  isDuplicate: boolean;
  setupComplexity: 'low' | 'medium' | 'high';
  lastVerifiedAt?: string;     // ISO date of last human/agent verification
  humanGateRequired: boolean;  // approvals must pass through a human
};

export type TrustResult = { trustScore: number; trustLevel: TrustLevel; trustGaps: string[] };

const RISK_PENALTY = { low: 0, medium: 10, high: 22 } as const;
const COMPLEXITY_PENALTY = { low: 0, medium: 6, high: 12 } as const;

export function computeTrust(f: TrustFactors): TrustResult {
  const gaps: string[] = [];
  let score = 0;

  if (f.sourceClarity) score += 20; else gaps.push('Source is unclear — add a URL or a local explanation of where this came from.');
  score += Math.round((Math.max(0, Math.min(100, f.usefulness)) / 100) * 20);
  if (f.usefulness < 40) gaps.push('Usefulness is weak — state the concrete daily use or ignore it.');
  if (f.testable) score += 15; else gaps.push('Not testable yet — write a test plan or verify command.');
  if (f.hasEvidence) score += 20; else gaps.push('No evidence — attach a receipt, test output, or proof link.');
  score += 12 - RISK_PENALTY[f.safetyRisk] / 2;
  if (f.safetyRisk === 'high') gaps.push('High safety risk — name what can go wrong and the human gate.');
  if (f.isDuplicate) { score -= 15; gaps.push('Duplicate of an existing item — merge or remove.'); }
  score += 8 - COMPLEXITY_PENALTY[f.setupComplexity];
  if (f.lastVerifiedAt) {
    const days = (Date.now() - new Date(f.lastVerifiedAt).getTime()) / 864e5;
    if (Number.isFinite(days) && days <= 30) score += 5; else gaps.push('Verification is stale — re-verify or downgrade.');
  } else {
    gaps.push('Never verified — run the test plan once.');
  }
  if (f.humanGateRequired) score += 5; // gated items are safer than ungated ones

  const trustScore = Math.max(0, Math.min(100, Math.round(score)));
  const trustLevel: TrustLevel =
    trustScore >= 85 ? 'approved' : trustScore >= 65 ? 'verified' : trustScore >= 40 ? 'promising' : 'untrusted';
  return { trustScore, trustLevel, trustGaps: gaps.slice(0, 6) };
}

// Approval floor: nothing is "approved" on vibes.
export type ApprovalInput = { note: string; testEvidence: string; sourceLinkOrExplanation: string; riskAccepted: boolean };
export function approvalGaps(a: ApprovalInput): string[] {
  const gaps: string[] = [];
  if (!a.note.trim()) gaps.push('Approval needs a note.');
  if (!a.testEvidence.trim()) gaps.push('Approval needs test evidence or an explicit reason.');
  if (!a.sourceLinkOrExplanation.trim()) gaps.push('Approval needs a source link or local explanation.');
  if (!a.riskAccepted) gaps.push('Risk must be explicitly accepted (or the item rejected).');
  return gaps;
}

export type EvalChecklistInput = {
  name: string;
  expectations: string[];      // what should happen
  antiExpectations: string[];  // what should not happen
  inputs: string[];
  expectedOutput: string;
  safetyChecks: string[];
  evidence: string[];
};

export function buildEvalChecklist(i: EvalChecklistInput): string {
  const list = (items: string[], fallback: string) => (items.length ? items : [fallback]).map(x => `- [ ] ${x}`).join('\n');
  return [
    `# Eval Checklist — ${i.name}`,
    ``,
    `## What should happen`,
    list(i.expectations, 'Define at least one expected behaviour.'),
    ``,
    `## What should not happen`,
    list(i.antiExpectations, 'No destructive commands, no external calls without approval, no scope creep.'),
    ``,
    `## Inputs to test`,
    list(i.inputs, 'Define one realistic input.'),
    ``,
    `## Expected output`,
    i.expectedOutput || 'Define the exact output that counts as success.',
    ``,
    `## Safety checks`,
    list(i.safetyChecks, 'Confirm no credentials, no auto-install, no unreviewed code execution.'),
    ``,
    `## Evidence required`,
    list(i.evidence, 'Quote the verify output or link the receipt.'),
    ``,
    `## Pass/fail decision`,
    `- [ ] PASS — promote status and record evidence`,
    `- [ ] FAIL — record rejection reason and archive or revise`,
  ].join('\n');
}
