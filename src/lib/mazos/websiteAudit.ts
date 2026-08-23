import dns from 'node:dns/promises';
import net from 'node:net';
import type { WebsiteAudit, WebsiteFinding } from './callDesk';

const MAX_BYTES = 1_000_000;
const MAX_REDIRECTS = 4;

export function normalizeWebsiteUrl(value: string) {
  const candidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  const url = new URL(candidate);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Website must use HTTP or HTTPS.');
  if (url.username || url.password) throw new Error('Website URLs cannot contain credentials.');
  if (!url.hostname) throw new Error('Website hostname is required.');
  url.hash = '';
  return url;
}

export function isPrivateAddress(address: string) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  if (net.isIPv6(address)) {
    const value = address.toLowerCase();
    if (value === '::' || value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb') || value.startsWith('ff')) return true;
    const mapped = value.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1];
    if (mapped) return isPrivateAddress(mapped);
    const mappedHex = value.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex) {
      const high = Number.parseInt(mappedHex[1], 16);
      const low = Number.parseInt(mappedHex[2], 16);
      return isPrivateAddress(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
    }
    const nat64 = value.match(/^64:ff9b::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (nat64) {
      const high = Number.parseInt(nat64[1], 16);
      const low = Number.parseInt(nat64[2], 16);
      return isPrivateAddress(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
    }
    return false;
  }
  return true;
}

export async function assertPublicWebsite(url: URL) {
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) throw new Error('Local and private websites cannot be checked.');
  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error('Local and private websites cannot be checked.');
    return;
  }
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!records.length || records.some(record => isPrivateAddress(record.address))) throw new Error('Website does not resolve to a public address.');
}

function has(pattern: RegExp, html: string) { return pattern.test(html); }
function content(pattern: RegExp, html: string) { return html.match(pattern)?.[1]?.replace(/\s+/g, ' ').trim() || ''; }

export function analyseWebsiteHtml(requestedUrl: string, finalUrl: string, statusCode: number, durationMs: number, html: string): WebsiteAudit {
  const title = content(/<title[^>]*>([\s\S]*?)<\/title>/i, html).slice(0, 160);
  const signals = {
    https: new URL(finalUrl).protocol === 'https:',
    viewport: has(/<meta[^>]+name=["']viewport["'][^>]*>/i, html),
    description: has(/<meta[^>]+name=["']description["'][^>]+content=["'][^"']{20,}["']/i, html) || has(/<meta[^>]+content=["'][^"']{20,}["'][^>]+name=["']description["']/i, html),
    contactPath: has(/href=["'][^"']*(?:contact|quote|book|tel:|mailto:)[^"']*["']/i, html),
    form: has(/<form\b/i, html),
    callToAction: has(/(?:get a quote|request a quote|book now|call now|contact us|enquire|get in touch)/i, html),
  };
  const findings: WebsiteFinding[] = [];
  if (statusCode >= 400) findings.push({ severity: 'high', label: `HTTP ${statusCode}`, evidence: `the homepage returned an HTTP ${statusCode} error during the check` });
  if (!signals.https) findings.push({ severity: 'high', label: 'No HTTPS', evidence: 'the homepage is not using an encrypted HTTPS connection' });
  if (!title) findings.push({ severity: 'medium', label: 'Missing page title', evidence: 'the homepage has no readable page title for search results and browser tabs' });
  if (!signals.viewport) findings.push({ severity: 'high', label: 'Mobile setup missing', evidence: 'the homepage does not declare a mobile viewport, so it may render poorly on phones' });
  if (!signals.description) findings.push({ severity: 'low', label: 'Missing description', evidence: 'the homepage does not provide a useful search-result description' });
  if (!signals.contactPath) findings.push({ severity: 'high', label: 'Contact path unclear', evidence: 'the homepage source does not expose a clear contact, quote, booking, phone, or email path' });
  if (!signals.callToAction) findings.push({ severity: 'medium', label: 'Call to action unclear', evidence: 'the homepage does not contain an obvious customer call to action' });
  if (durationMs > 3000) findings.push({ severity: 'medium', label: 'Slow response', evidence: `the homepage took ${(durationMs / 1000).toFixed(1)} seconds to respond during the check` });
  if (!findings.length) findings.push({ severity: 'positive', label: 'Core checks passed', evidence: 'the homepage passed the bounded technical and conversion-signal checks' });
  const deductions = findings.reduce((sum, item) => sum + (item.severity === 'high' ? 18 : item.severity === 'medium' ? 10 : item.severity === 'low' ? 5 : 0), 0);
  const score = Math.max(0, 100 - deductions);
  return {
    checkedAt: new Date().toISOString(), requestedUrl, finalUrl, reachable: statusCode < 500, statusCode, durationMs, score, title,
    summary: findings[0].evidence,
    signals, findings,
  };
}

async function readBoundedBody(response: Response) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel(); throw new Error('Homepage is larger than the 1 MB audit limit.'); }
    chunks.push(value);
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(output);
}

export async function auditWebsite(value: string) {
  const requested = normalizeWebsiteUrl(value);
  let current = requested;
  const startedAt = Date.now();
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    await assertPublicWebsite(current);
    const response = await fetch(current, {
      redirect: 'manual', signal: AbortSignal.timeout(10_000),
      headers: { 'user-agent': 'MazWorks-Website-Check/1.0 (+https://mazworks.co.uk)' },
    });
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      current = new URL(response.headers.get('location')!, current);
      if (!['http:', 'https:'].includes(current.protocol)) throw new Error('Website redirected to an unsupported protocol.');
      continue;
    }
    const type = response.headers.get('content-type') || '';
    if (!type.includes('text/html')) throw new Error(`Website returned ${type || 'a non-HTML response'}.`);
    const html = await readBoundedBody(response);
    return analyseWebsiteHtml(requested.toString(), current.toString(), response.status, Date.now() - startedAt, html);
  }
  throw new Error('Website redirected too many times.');
}
