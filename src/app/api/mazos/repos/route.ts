import { NextResponse } from 'next/server';
import { scanRepos } from '@/lib/mazos/repoScanner';
export async function GET() { return NextResponse.json({ repos: scanRepos() }); }
