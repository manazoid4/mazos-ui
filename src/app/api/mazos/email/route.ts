import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.NOTIFY_EMAIL || 'manazoid4@gmail.com';
  const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev'; // Resend's default testing domain

  if (!apiKey) {
    return NextResponse.json({ status: 'inactive', reason: 'Missing RESEND_API_KEY' }, { status: 200 });
  }

  // We consider it active if the key is present.
  return NextResponse.json({ 
    status: 'active', 
    config: {
      to: toEmail,
      from: fromEmail,
      keyPresent: true
    }
  });
}
