import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Note: In a real app, this would use a database.
// For now, we store sessions in a local JSON file in the Hermes directory or project directory.

function getFocusFilePath() {
  const base = path.join(process.env.USERPROFILE || process.env.HOME || '', '.hermes', 'mazos');
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
  return path.join(base, 'focus-sessions.json');
}

export async function GET() {
  try {
    const filePath = getFocusFilePath();
    if (!fs.existsSync(filePath)) return NextResponse.json([]);
    const data = fs.readFileSync(filePath, 'utf8');
    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read sessions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await request.json();
    const filePath = getFocusFilePath();
    
    let sessions = [];
    if (fs.existsSync(filePath)) {
      sessions = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    
    sessions.push(session);
    fs.writeFileSync(filePath, JSON.stringify(sessions, null, 2));
    
    return NextResponse.json({ success: true, session });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save session' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
    try {
      const updatedSession = await request.json();
      const filePath = getFocusFilePath();
      
      if (!fs.existsSync(filePath)) {
         return NextResponse.json({ error: 'No sessions found' }, { status: 404 });
      }
      
      let sessions = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const index = sessions.findIndex((s: any) => s.id === updatedSession.id);
      
      if (index === -1) {
          return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      sessions[index] = { ...sessions[index], ...updatedSession };
      fs.writeFileSync(filePath, JSON.stringify(sessions, null, 2));
      
      return NextResponse.json({ success: true, session: sessions[index] });
    } catch (error) {
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
    }
  }
