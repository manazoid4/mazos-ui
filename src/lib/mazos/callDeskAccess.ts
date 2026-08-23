const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function isLocalCallDeskUrl(value: string, options: { vercel?: boolean; desktopToken?: boolean } = {}) {
  if (options.vercel) return false;
  if (options.desktopToken) return true;
  try { return LOOPBACK_HOSTS.has(new URL(value).hostname.toLowerCase()); }
  catch { return false; }
}

export function isLocalCallDeskRequest(req: Request) {
  return isLocalCallDeskUrl(req.url, {
    vercel: process.env.VERCEL === '1',
    desktopToken: Boolean(process.env.MAZOS_DESKTOP_TOKEN),
  });
}
