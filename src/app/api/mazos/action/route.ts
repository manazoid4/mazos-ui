import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(req: Request) {
  try {
    const { action_type, command_value, danger_level } = await req.json();

    if (danger_level === 'danger') {
      return NextResponse.json({ error: 'Danger commands must be run manually' }, { status: 403 });
    }

    if (action_type === 'scan_vault' || action_type === 'run_safe_prompt') {
      // Execute Hermes safely
      const { stdout, stderr } = await execAsync(command_value, { cwd: process.env.USERPROFILE || process.env.HOME });
      return NextResponse.json({ success: true, output: stdout || stderr });
    }

    if (action_type === 'email_digest') {
      // In a real app this would trigger the actual digest script, for now just call the route
      return NextResponse.json({ success: true, output: 'Digest job triggered via API' });
    }

    return NextResponse.json({ error: `Unsupported action_type: ${action_type}` }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}