import { NextResponse } from 'next/server';
import { serviceHealth } from '@/lib/mazos/serviceHealth';
export async function GET() { return NextResponse.json({ services: await serviceHealth() }); }
