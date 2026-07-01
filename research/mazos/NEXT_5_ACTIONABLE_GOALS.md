# Next 5 Actionable Goals

Date: 2026-07-01
Source: revenue, UX/product, engineering specialist agents.

## 1. JobFilter WhatsApp lead loop → first paid pilot

Why: fastest cash path. Vault says JobFilter revenue path is Twilio WhatsApp → Supabase leads → QR → auth → Stripe. Stripe/auth can wait.

Next 3 steps:
1. Wire WhatsApp inbound → Supabase `leads`.
2. Make/share QR sticker link into WhatsApp intake.
3. Manually qualify 20 leads; ask 3 tradesmen for paid concierge pilot.

Done when:
- 20 real inbound leads captured.
- 3 payment asks made.
- 1 paid/manual pilot invoice or payment link sent.

## 2. Recall audit/smoke → sell or freeze in 1 day

Why: closest to paying, but MVP unclear. Ambiguity is blocking revenue.

Next 3 steps:
1. Run Recall smoke: signup/login/core capture/export.
2. Write 1-line ICP + 1 paid use-case.
3. If smoke passes, book 5 demos; if not, freeze and stop polishing.

Done when:
- Recall smoke report exists.
- Sell/freeze decision made.
- If sell: 5 demo targets listed.

## 3. MazOS first-viewport “What now?” brain

Why: cockpit must decide next action, not just show telemetry.

Next 3 steps:
1. Rank signals: Obsidian active task → intake queue → dirty repo → broken build → missing source capability.
2. Show one primary recommendation with reason/confidence.
3. Open “why this?” modal with evidence sources.

Done when:
- First viewport answers: `Do X now because Y`.
- Evidence modal cites vault/repo/intake/run signal.

## 4. Capture Inbox v2: YouTube/Instagram/X/PDF → intent → queue/result

Why: URL textarea is too dumb. Intake should route sources by type and goal.

Next 3 steps:
1. Server-side detect `youtube|instagram|x|pdf|webpage|text|unknown`.
2. Require intent: save, summarize, extract tasks, research/emulate, add Obsidian.
3. Return clean result card: source, title/summary if known, saved path, failures, next action.

Done when:
- Valid URL queues/routes.
- PDF/file bounds enforced.
- Unsupported types queue with clear reason, no fake success.

## 5. Engineering hardening: warnings/errors that erode trust

Why: cockpit is only useful if basic signals are trustworthy.

Next 3 steps:
1. Fix Next workspace-root warning via `next.config.*` `turbopack.root`.
2. Add command timeout clarity in `runCommand.ts`.
3. Validate unknown action IDs with explicit HTTP 400 JSON; harden ingest limits.

Done when:
- `npm run lint && npm run build` passes with no root warning.
- Timeout/unknown-action/oversize-ingest paths return clear errors.
