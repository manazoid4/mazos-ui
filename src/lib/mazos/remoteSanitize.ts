export type RedactionReport = {
  redactions: number;
  rules: Record<string, number>;
};

type SanitizeResult<T> = {
  value: T;
  report: RedactionReport;
};

const RULES: { name: string; pattern: RegExp; replacement: string }[] = [
  { name: 'windowsPath', pattern: /[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*/g, replacement: '[REDACTED_PATH]' },
  { name: 'unixUserPath', pattern: /\/(?:Users|home)\/[A-Za-z0-9._-]+(?:\/[^\s"'<>)]*)?/g, replacement: '[REDACTED_PATH]' },
  { name: 'envFile', pattern: /(^|[\\/])\.env(?:\.[A-Za-z0-9_-]+)?/g, replacement: '[REDACTED_ENV_FILE]' },
  { name: 'openAiKey', pattern: /sk-[A-Za-z0-9_-]{20,}/g, replacement: '[REDACTED_SECRET]' },
  { name: 'genericToken', pattern: /\b(?:ANTHROPIC|OPENAI|CLAUDE|GEMINI|SUPABASE|STRIPE|RESEND|VERCEL|GITHUB|GH|NPM|DATABASE|JWT)[A-Z0-9_]*(?:\s*[:=]\s*)[A-Za-z0-9._~+/=-]{8,}/gi, replacement: '[REDACTED_SECRET]' },
  { name: 'bearerToken', pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, replacement: 'Bearer [REDACTED_SECRET]' },
  { name: 'privateSpiritual', pattern: /\b(?:awrad|wird|wirds|teacher instructions)\b/gi, replacement: '[REDACTED_PRIVATE]' },
];

function makeReport(): RedactionReport {
  return { redactions: 0, rules: {} };
}

function record(report: RedactionReport, rule: string, count: number) {
  if (!count) return;
  report.redactions += count;
  report.rules[rule] = (report.rules[rule] || 0) + count;
}

function redactString(input: string, report: RedactionReport) {
  return RULES.reduce((current, rule) => {
    let count = 0;
    const next = current.replace(rule.pattern, () => {
      count += 1;
      return rule.replacement;
    });
    record(report, rule.name, count);
    return next;
  }, input);
}

function sanitizeUnknown(value: unknown, report: RedactionReport, depth = 0): unknown {
  if (depth > 20) return '[REDACTED_DEPTH_LIMIT]';
  if (typeof value === 'string') return redactString(value, report);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeUnknown(item, report, depth + 1));
  if (typeof value !== 'object') return undefined;

  const sanitized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const redactedKey = redactString(key, report);
    sanitized[redactedKey] = sanitizeUnknown(item, report, depth + 1);
  }
  return sanitized;
}

export function sanitizeForRemote<T>(value: T): SanitizeResult<T> {
  const report = makeReport();
  return { value: sanitizeUnknown(value, report) as T, report };
}

export function isRemoteSafe(value: unknown) {
  return sanitizeForRemote(value).report.redactions === 0;
}
