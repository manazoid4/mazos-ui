import { readResearchConsole } from '@/lib/mazos/research';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(readResearchConsole());
}
