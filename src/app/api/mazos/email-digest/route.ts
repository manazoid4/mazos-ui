import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function getFallbackPath() {
  const base = path.join(process.env.USERPROFILE || process.env.HOME || '', '.hermes', 'mazos');
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
  return path.join(base, 'weekly-digest-fallback.md');
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const toEmail = process.env.NOTIFY_EMAIL || 'manazoid4@gmail.com';
    const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';

    // In a real digest, we'd pull from priority repos, GitHub API, and Hermes session DB.
    // For now, simulate digest content.
    const digestContent = `MazOS Weekly Digest
===================
Date: ${new Date().toISOString()}

Focus Sessions this week: (Coming soon)
Priority Repos: JobFilter (Active)

Blockers: None detected.
`;

    if (!apiKey) {
      // Fallback to markdown
      const fallbackPath = getFallbackPath();
      fs.writeFileSync(fallbackPath, digestContent);
      return NextResponse.json({ 
        success: true, 
        status: 'fallback_saved', 
        output: `Email inactive. Saved digest to ${fallbackPath}` 
      });
    }

    // Try sending via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: toEmail,
        subject: 'MazOS Weekly Digest',
        text: digestContent
      })
    });

    if (!res.ok) {
      const errData = await res.text();
      // Fallback on error
      const fallbackPath = getFallbackPath();
      fs.writeFileSync(fallbackPath, digestContent + '\n\nResend Error: ' + errData);
      return NextResponse.json({ 
        success: true, 
        status: 'fallback_saved', 
        output: `Resend API failed. Saved digest to ${fallbackPath}. Error: ${errData}` 
      });
    }

    const data = await res.json();
    return NextResponse.json({ 
      success: true, 
      status: 'email_sent', 
      output: `Email sent successfully (ID: ${data.id}) to ${toEmail}` 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
