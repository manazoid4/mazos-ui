import { NextResponse } from 'next/server';
import {
  buildPack,
  buildPackSummary,
  packReadme,
  readPacks,
  seedStarterPacks,
  writePacks,
  type Pack,
  type PackStatus,
} from '@/lib/mazos/loopStore';

export const dynamic = 'force-dynamic';

function readSeeded() {
  const current = readPacks();
  const seeded = seedStarterPacks(current);
  if (seeded.length !== current.length) writePacks(seeded);
  return seeded;
}

function response(packs: Pack[]) {
  return NextResponse.json({ packs, summary: buildPackSummary(packs) });
}

export async function GET(req: Request) {
  const packs = readSeeded();
  const id = new URL(req.url).searchParams.get('readme');
  if (id) {
    const pack = packs.find((item) => item.id === id);
    if (!pack) return NextResponse.json({ error: 'Pack not found.' }, { status: 404 });
    return NextResponse.json({ pack, readme: packReadme(pack) });
  }
  return response(packs);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  if (!name) return NextResponse.json({ error: 'Pack name required.' }, { status: 400 });

  const current = readSeeded();
  const pack = buildPack({ ...body, name });
  const packs = [pack, ...current.filter((item) => item.id !== pack.id)];
  writePacks(packs);
  return NextResponse.json({ pack, readme: packReadme(pack), packs, summary: buildPackSummary(packs) });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || '');
  if (!id) return NextResponse.json({ error: 'Missing pack id.' }, { status: 400 });

  let found = false;
  const packs = readSeeded().map((pack) => {
    if (pack.id !== id) return pack;
    found = true;
    return {
      ...pack,
      status: body.status ? String(body.status) as PackStatus : pack.status,
      proofReceipts: Array.isArray(body.proofReceipts) ? body.proofReceipts.map(String) : pack.proofReceipts,
      usefulnessScore: body.usefulnessScore !== undefined ? Number(body.usefulnessScore) : pack.usefulnessScore,
      updatedAt: new Date().toISOString(),
    };
  });

  if (!found) return NextResponse.json({ error: 'Pack not found.' }, { status: 404 });
  writePacks(packs);
  return response(packs);
}
