// Product Playbooks: per-product strategy contracts that tell agents (and Maz) what
// good work looks like. Grounded in the real repo READMEs, not aspirational copy.
// Pure module — client-safe. The Shipping Spine consumes these server-side.

export type ProductId = 'jobfilter' | 'recall' | 'openflowkit' | 'mazos';

export type Playbook = {
  id: ProductId;
  name: string;
  statusQuery: string;        // query string for latestProjectStatus()
  shipLogLabel: string;       // repo label used by shipLog/repoScanner
  audience: string;
  paidOutcome: string;        // why this matters commercially — the money sentence
  moat: string;
  currentWedge: string;       // the objective right now
  currentBet: string;         // default next shippable action when repo evidence is silent
  forbiddenBloat: string[];
  topMetrics: string[];
  doneCriteria: string[];
  defaultOwner: 'Maz' | 'Hermes' | 'Codex';
};

export const PLAYBOOKS: Playbook[] = [
  {
    id: 'jobfilter',
    name: 'JobFilter',
    statusQuery: 'JobFilter',
    shipLogLabel: 'JobFilter',
    audience: 'UK tradesmen who want real leads without chasing or competing.',
    paidOutcome: 'Tradesmen pay for a filtered intake of real, winnable UK work (live Contracts Finder procurement notices today).',
    moat: 'Lead quality + niche UK trade focus; competitors sell noise, JobFilter sells signal.',
    currentWedge: 'Convert lead quality into paying users: sharpen /find-jobs signal and the path from lead view to paid.',
    currentBet: 'Ship one improvement to the lead-to-paid conversion path on /find-jobs and verify it against live Contracts Finder data.',
    forbiddenBloat: ['Generic job board features', 'CRM/calendar suites', 'Chasing non-UK markets before UK converts'],
    topMetrics: ['Paying users', 'Lead view → contact conversion', 'Lead quality (rejected-as-junk rate)'],
    doneCriteria: ['Change verified against live /find-jobs data', 'Lint/build pass', 'Commit or PR link recorded'],
    defaultOwner: 'Hermes',
  },
  {
    id: 'recall',
    name: 'Recall',
    statusQuery: 'Recall',
    shipLogLabel: 'Recall',
    audience: 'People who save/watch/read heavily and lose it all; Maz is user zero.',
    paidOutcome: 'Subscription for a user-owned personal intelligence layer — saved content becomes a living memory graph agents can use.',
    moat: 'User-owned memory graph + taste/intent models that compound with every capture; switching cost grows daily.',
    currentWedge: 'Cut capture friction so the memory graph actually grows from daily real usage.',
    currentBet: 'Ship one capture-friction fix (fastest path from "saw it" to "saved and enriched") and prove it with a real capture.',
    forbiddenBloat: ['Generic chat UI', 'Social features before memory works', 'Scraping private/authed content'],
    topMetrics: ['Captures per day', 'Retrieval hits that changed a decision', 'Graph size growth'],
    doneCriteria: ['One real capture flows end-to-end', 'Lint/build pass', 'Evidence file or commit recorded'],
    defaultOwner: 'Hermes',
  },
  {
    id: 'openflowkit',
    name: 'OpenFlowKit',
    statusQuery: 'OpenFlowKit',
    shipLogLabel: 'OpenFlowKit',
    audience: 'Developers and writers who want privacy-first voice dictation across apps, IDEs, and LLM workflows.',
    paidOutcome: 'Open-source voice dictation + AI text refinement kit (Wispr Flow class); monetises via hosted/pro tier once the local kit is loved.',
    moat: 'LLM-agnostic, local-or-cloud STT, works in any text field — open where competitors are closed.',
    currentWedge: 'Make daily dictation reliable enough that Maz uses it for real work every day.',
    currentBet: 'Fix the top daily-use dictation failure and dogfood it for one full working session.',
    forbiddenBloat: ['Generic transcription demo features', 'Cloud lock-in', 'Workflow-automation scope creep'],
    topMetrics: ['Daily dictation sessions', 'Words dictated per day', 'Transcription correction rate'],
    doneCriteria: ['Dictation verified in a real app/IDE', 'Lint/build pass', 'Commit or PR link recorded'],
    defaultOwner: 'Hermes',
  },
  {
    id: 'mazos',
    name: 'MAZos',
    statusQuery: 'MAZos',
    shipLogLabel: 'MAZos UI',
    audience: 'Maz + his agents (Codex, Hermes/Claude, OpenCode). Not a public product yet.',
    paidOutcome: 'Indirect: velocity multiplier — every hour MAZos saves goes into JobFilter/Recall revenue work. It earns its keep or it shrinks.',
    moat: 'Local-first private repo/vault truth + hosted access + shared agent context no generic AI workspace can see.',
    currentWedge: 'Shipping Spine: open MAZos → know what to ship next across all products, with evidence.',
    currentBet: 'Only work on MAZos when it directly unblocks product velocity; otherwise route effort to JobFilter or Recall.',
    forbiddenBloat: ['Generic chat UI', 'Autonomous loops before evidence model is reliable', 'CRM/calendar/email/analytics suites', 'Decorative panels'],
    topMetrics: ['Time from open → next action known', 'Handoffs generated and used', 'Product commits shipped per week'],
    doneCriteria: ['Panel/API answers a shipping question', 'Hosted site reads it via bridge', 'Lint/build pass'],
    defaultOwner: 'Codex',
  },
];

export function playbookById(id: string): Playbook | null {
  return PLAYBOOKS.find(p => p.id === id) || null;
}
