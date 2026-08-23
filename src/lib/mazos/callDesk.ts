export type RegisterResult = 'unknown' | 'clear' | 'registered' | 'consented';
export type SuppressionResult = 'unknown' | 'clear' | 'blocked';
export type ProspectStatus = 'new' | 'researching' | 'ready' | 'follow_up' | 'booked' | 'won' | 'not_interested' | 'do_not_call' | 'archived';
export type CallOutcome = 'no_answer' | 'gatekeeper' | 'interested' | 'follow_up' | 'booked' | 'not_interested' | 'do_not_call';

export type WebsiteFinding = {
  severity: 'high' | 'medium' | 'low' | 'positive';
  label: string;
  evidence: string;
};

export type WebsiteAudit = {
  checkedAt: string;
  requestedUrl: string;
  finalUrl: string;
  reachable: boolean;
  statusCode: number | null;
  durationMs: number;
  score: number;
  title: string;
  summary: string;
  signals: {
    https: boolean;
    viewport: boolean;
    description: boolean;
    contactPath: boolean;
    form: boolean;
    callToAction: boolean;
  };
  findings: WebsiteFinding[];
};

export type CallRecord = {
  id: string;
  at: string;
  outcome: CallOutcome;
  notes: string;
  nextAction: string;
  followUpAt: string;
};

export type Prospect = {
  id: string;
  businessName: string;
  contactName: string;
  phone: string;
  website: string;
  area: string;
  trade: string;
  source: string;
  status: ProspectStatus;
  screening: {
    tps: RegisterResult;
    ctps: RegisterResult;
    ownList: SuppressionResult;
    checkedAt: string;
    note: string;
  };
  websiteAudit: WebsiteAudit | null;
  notes: string;
  nextAction: string;
  followUpAt: string;
  calls: CallRecord[];
  createdAt: string;
  updatedAt: string;
};

export const EMPTY_SCREENING: Prospect['screening'] = {
  tps: 'unknown', ctps: 'unknown', ownList: 'unknown', checkedAt: '', note: '',
};

const STATUSES: ProspectStatus[] = ['new', 'researching', 'ready', 'follow_up', 'booked', 'won', 'not_interested', 'do_not_call', 'archived'];
const REGISTER_RESULTS: RegisterResult[] = ['unknown', 'clear', 'registered', 'consented'];
const SUPPRESSION_RESULTS: SuppressionResult[] = ['unknown', 'clear', 'blocked'];

function text(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max);
}

function oneOf<T extends string>(value: unknown, options: T[], fallback: T): T {
  return options.includes(value as T) ? value as T : fallback;
}

export function normalizeProspect(input: Partial<Prospect>, current?: Prospect): Prospect {
  const now = new Date().toISOString();
  const screening = input.screening ?? current?.screening ?? EMPTY_SCREENING;
  const businessName = text(input.businessName ?? current?.businessName, 120);
  const phone = text(input.phone ?? current?.phone, 40);
  if (!businessName) throw new Error('Business name is required.');
  if (!phone) throw new Error('Phone number is required.');

  return {
    id: text(input.id ?? current?.id, 80) || `prospect-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`,
    businessName,
    contactName: text(input.contactName ?? current?.contactName, 100),
    phone,
    website: text(input.website ?? current?.website, 500),
    area: text(input.area ?? current?.area, 100),
    trade: text(input.trade ?? current?.trade, 100),
    source: text(input.source ?? current?.source, 200),
    status: oneOf(input.status ?? current?.status, STATUSES, 'new'),
    screening: {
      tps: oneOf(screening.tps, REGISTER_RESULTS, 'unknown'),
      ctps: oneOf(screening.ctps, REGISTER_RESULTS, 'unknown'),
      ownList: oneOf(screening.ownList, SUPPRESSION_RESULTS, 'unknown'),
      checkedAt: text(screening.checkedAt, 40),
      note: text(screening.note, 500),
    },
    websiteAudit: input.websiteAudit === undefined ? current?.websiteAudit ?? null : input.websiteAudit,
    notes: text(input.notes ?? current?.notes, 5000),
    nextAction: text(input.nextAction ?? current?.nextAction, 500),
    followUpAt: text(input.followUpAt ?? current?.followUpAt, 40),
    calls: Array.isArray(input.calls) ? input.calls.slice(-100) : current?.calls ?? [],
    createdAt: current?.createdAt ?? (text(input.createdAt, 40) || now),
    updatedAt: now,
  };
}

export function callReadiness(prospect: Prospect, now = new Date()) {
  const reasons: string[] = [];
  if (!prospect.phone) reasons.push('Add a phone number.');
  if (!prospect.source) reasons.push('Record where the public business details came from.');
  if (!prospect.websiteAudit) reasons.push('Run and save the bounded website check before using an evidence-led script.');
  if (prospect.status === 'do_not_call' || prospect.screening.ownList === 'blocked') reasons.push('Suppressed on the Maz Works do-not-call list.');
  if (!['clear', 'consented'].includes(prospect.screening.tps)) reasons.push(prospect.screening.tps === 'registered' ? 'TPS registered — do not call without specific consent.' : 'TPS result has not been recorded.');
  if (!['clear', 'consented'].includes(prospect.screening.ctps)) reasons.push(prospect.screening.ctps === 'registered' ? 'CTPS registered — do not call without specific consent.' : 'CTPS result has not been recorded.');
  if (prospect.screening.ownList === 'unknown') reasons.push('Internal do-not-call list has not been checked.');
  if ((prospect.screening.tps === 'consented' || prospect.screening.ctps === 'consented') && !prospect.screening.note) reasons.push('Record when and how specific consent was given.');
  if (!prospect.screening.checkedAt) reasons.push('Record when the screening was completed.');
  else {
    const age = now.getTime() - new Date(prospect.screening.checkedAt).getTime();
    if (!Number.isFinite(age) || age < 0 || age > 28 * 24 * 60 * 60 * 1000) reasons.push('Screening is older than the 28-day Maz Works operating policy.');
  }
  return { ready: reasons.length === 0, reasons };
}

export function strongestFinding(prospect: Prospect) {
  return prospect.websiteAudit?.findings.find(finding => finding.severity !== 'positive')?.evidence
    || 'there may be a few small points where the website could make the next step clearer for customers';
}

export function buildCallScript(prospect: Prospect) {
  const name = prospect.contactName || 'the person who looks after the website';
  const evidence = strongestFinding(prospect);
  return [
    {
      id: 'permission',
      title: 'Permission opener',
      text: `Hi, it’s Maz from Maz Works. I’m trying to reach ${name} at ${prospect.businessName}. I was looking at your public website and noticed ${evidence}. Have you got 30 seconds for me to explain why I called, then you can tell me if it is relevant?`,
    },
    {
      id: 'discovery',
      title: 'Discovery — listen, do not pitch',
      prompts: [
        'How do most new customers find you at the moment?',
        'When somebody visits the website, what is the main action you want them to take?',
        'Do you know where enquiries tend to drop off or get stuck?',
        'Who normally handles website changes when something needs fixing?',
        'If one issue could be fixed this month, what would make the biggest difference?',
      ],
    },
    {
      id: 'bridge',
      title: 'Evidence bridge',
      text: `That makes sense. The reason I called is that I found a specific, visible issue: ${evidence}. I can send you the short evidence note so you can judge it yourself — no vague redesign pitch.`,
    },
    {
      id: 'offer',
      title: 'Bounded offer',
      text: 'If the evidence is useful, my starter offer is a fixed £150 Website Rescue Sprint: we agree one high-impact problem, I fix that bounded scope, verify it, and hand over the proof. Anything larger is quoted separately before work starts.',
    },
    {
      id: 'close',
      title: 'Close',
      text: 'Would it be useful to book a 15-minute screen-share so I can show you the evidence and we can decide whether that one sprint is worth doing?',
    },
  ];
}

export const OBJECTION_RESPONSES = [
  { label: 'We already have someone', text: 'That is completely fine — I am not asking you to replace them. I can send the evidence for your existing person to assess, or handle one bounded issue if they are overloaded.' },
  { label: 'Send an email', text: 'Happy to. So I do not send generic noise, which address is best, and should I include the short evidence note plus the fixed-scope option?' },
  { label: 'No budget', text: 'Understood. I will not push it. Would the free evidence note still be useful for when the timing is better?' },
  { label: 'Not interested', text: 'No problem — I will mark that and won’t keep chasing you. Thanks for being direct.' },
  { label: 'How did you get this number?', text: 'It was published as the business contact number. I screened it before calling, and I can add it to our do-not-call list immediately if you prefer.' },
];

export function statusForOutcome(outcome: CallOutcome): ProspectStatus {
  if (outcome === 'booked') return 'booked';
  if (outcome === 'follow_up' || outcome === 'interested' || outcome === 'no_answer' || outcome === 'gatekeeper') return 'follow_up';
  if (outcome === 'not_interested') return 'not_interested';
  return 'do_not_call';
}
