export function checkRemoteWriteAuth(req: Request, tokenEnvName: 'MAZOS_REMOTE_SYNC_TOKEN' | 'MAZOS_REMOTE_READ_TOKEN') {
  const configuredToken = process.env[tokenEnvName];
  if (!configuredToken && process.env.VERCEL) {
    return { ok: false, status: 503, error: `${tokenEnvName} is required in hosted runtime.` };
  }

  if (!configuredToken) return { ok: true };

  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  if (token !== configuredToken) {
    return { ok: false, status: 401, error: 'Unauthorized remote MAZos request.' };
  }

  return { ok: true };
}
