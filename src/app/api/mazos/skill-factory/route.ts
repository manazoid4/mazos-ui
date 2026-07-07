import { NextResponse } from 'next/server';
import { buildSummary, readInbox, writeInbox } from '@/lib/mazos/aiSourceInbox';
import {
  approvalBlockers,
  buildSkillSummary,
  generateSkillSpec,
  readSkills,
  skillEvalChecklist,
  skillSpecMarkdown,
  writeSkills,
  type SkillSpec,
  type SkillStatus,
} from '@/lib/mazos/skillFactory';

export const dynamic = 'force-dynamic';

function response(skills: SkillSpec[]) {
  return NextResponse.json({ skills, summary: buildSkillSummary(skills) });
}

export async function GET() {
  const skills = readSkills();
  return response(skills);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const sourceItemId = String(body.sourceItemId || '');
  const rawText = String(body.rawText || body.text || '');
  const inbox = readInbox();
  const sourceItem = sourceItemId ? inbox.find((item) => item.id === sourceItemId) : undefined;

  if (sourceItemId && !sourceItem) return NextResponse.json({ error: 'Source item not found.' }, { status: 404 });
  if (!sourceItem && !rawText.trim()) return NextResponse.json({ error: 'Expected sourceItemId or rawText.' }, { status: 400 });

  const draft = generateSkillSpec({ sourceItem, rawText });
  const existing = readSkills().filter((skill) => skill.id !== draft.id);
  const skills = [draft, ...existing];
  writeSkills(skills);

  if (sourceItem) {
    const nextInbox = inbox.map((item) => item.id === sourceItem.id ? { ...item, status: 'skill_candidate' as const, updatedAt: new Date().toISOString() } : item);
    writeInbox(nextInbox);
  }

  return NextResponse.json({
    skill: draft,
    markdown: skillSpecMarkdown(draft),
    evalChecklist: skillEvalChecklist(draft),
    skills,
    summary: buildSkillSummary(skills),
    inboxSummary: buildSummary(readInbox()),
  });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || '');
  if (!id) return NextResponse.json({ error: 'Missing skill id.' }, { status: 400 });

  const requestedStatus = body.status ? String(body.status) as SkillStatus : undefined;
  if (requestedStatus === 'approved') {
    const gaps = approvalBlockers({
      note: String(body.approvalNote || ''),
      testEvidence: String(body.testEvidence || ''),
      sourceLinkOrExplanation: String(body.sourceLinkOrExplanation || ''),
      riskAccepted: Boolean(body.riskAccepted),
    });
    if (gaps.length) return NextResponse.json({ error: 'Approval blocked.', gaps }, { status: 400 });
  }

  let found = false;
  const skills = readSkills().map((skill) => {
    if (skill.id !== id) return skill;
    found = true;
    return {
      ...skill,
      status: requestedStatus || skill.status,
      rejectionReasons: Array.isArray(body.rejectionReasons) ? body.rejectionReasons.map(String) : skill.rejectionReasons,
      usefulnessScore: body.usefulnessScore !== undefined ? Number(body.usefulnessScore) : skill.usefulnessScore,
      trustScore: body.trustScore !== undefined ? Number(body.trustScore) : skill.trustScore,
      updatedAt: new Date().toISOString(),
    };
  });

  if (!found) return NextResponse.json({ error: 'Skill not found.' }, { status: 404 });
  writeSkills(skills);
  return response(skills);
}
