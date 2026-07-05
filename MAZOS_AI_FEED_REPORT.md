# MAZos AI Feed Report

Date: 2026-07-05

## Research Used

The v1 feed design follows the research/spec in `specs/mazos-ai-feed.md`:

- Linear Inbox: activity should behave like a triage inbox, not a noisy timeline.
- GitHub Notifications: filters and attention state are useful for developer workflows.
- Slack Activity: one consolidated catch-up surface reduces tab switching.
- Devin and OpenHands: agent systems need event/trajectory continuity and easy handoff.

MAZos-specific doctrine from `docs/MAZOS_MARKET_BREAKER_ROADMAP.md` won: every panel must reduce decision load and answer what should ship next.

## What Shipped

- Added `GET /api/mazos/feed`.
- Added `src/lib/mazos/feed.ts` deterministic aggregator.
- Added `FEED` tab to the main MAZos cockpit.
- Feed sources:
  - Shipping Spine
  - Decision Inbox
  - Run history
  - Stale Work Radar
  - Ship Log
  - Intake queue
  - OpenWiki status
- Added compact feed verdict, filters, attention-only mode, evidence modal, copyable prompt per item, and safety badges.
- Updated README.

## Safety

- No shell execution.
- No LLM calls.
- No external RSS/web crawling.
- No cron.
- No database or JSONL writes.
- No agent launch.
- All item actions are read-only links, evidence modals, or copyable prompts.

## API

`GET /api/mazos/feed`

Query params:

- `limit`, default `12`, max `30`
- `product`
- `type`
- `attentionOnly=true`

Response includes `verdict`, `filters`, `items`, `degraded`, and `warnings`.

## Validation

- `npm run lint`: passed.
- `npm run build`: passed. Build emitted the existing non-fatal Turbopack warnings for OpenWiki local Windows/Python tracing and root lockfile inference.
- Local `GET http://127.0.0.1:3046/api/mazos/feed`: passed.
- Local root page smoke check returned 200. Existing dev server on `3046` held the Next project lock, so a second branch-specific dev server could not start on `3051`.
- PR #17 merged.
- Production deployment `dpl_obMah8Nezzf6WgyDrGwfLMV7uoB7`: Ready.
- Hosted `GET https://mazos-command-centre.vercel.app/api/mazos/feed`: passed.
- Hosted `https://mazos-command-centre.vercel.app/`: returned 200.

## v1.1 — Ops-Layer Upgrade (2026-07-05, branch `agents/feed-ops-layer`)

Goal: turn the feed from an activity list into an operating layer. Every change serves "what changed, and does it change what ships next" — no decorative additions.

### Ranking (revenue + velocity)

- Revenue weighting: playbook `moneyLabel` from the Shipping Spine now feeds item scores (`high` +8, `medium` +4). Signals on the money product outrank equal signals elsewhere.
- Spine is computed once per feed build and shared, instead of per-source recomputes.
- Ship-log commits on the current spine priority get +5 and a "direct progress" why; off-priority commits get −5 and an explicit "no action needed".

### Item quality (noise cuts)

- Runs: all failures kept, but only the 2 most recent passes (proof), older passes dropped.
- Ship log: capped 6 commits (was 10), 4 per day (was 6).
- Decisions: all open + 3 most recent resolved (was flat 10).
- Intake: capped 5 (was 8).
- `whyItMatters`/`nextAction` rewritten to be product-specific and directive (e.g. stale items now carry repo path + branch as evidence).

### Agent handoff

- Copy prompts restructured: OBJECTIVE / CONTEXT / EVIDENCE / READ FIRST / VERIFY WITH / REPORT BACK format, scoped to one item.
- Spine feed item now reuses the real Shipping Spine handoff prompt (repo, branch, verify, done criteria) instead of the generic template.
- New `→ Task Gate` button on every feed item: drafts the item into `/sessions` (localStorage handshake) for preflight scoring before launch.

### System internals

- New `GET /api/mazos/system` + `src/lib/mazos/systemInfo.ts`: CPU usage/cores, RAM, GPU VRAM/util/temp via read-only `nvidia-smi` query, disk free, uptime. Hosted returns `local:false`; the UI hides the strip.
- New cockpit strip under the header (local mode only) with hot-red highlighting at ≥90% CPU / ≥92% RAM / ≥92% VRAM.
- Feed emits a `system` attention item on RAM/VRAM pressure ≥92% so degraded local capacity is visible before agent runs fail.

### UI

- Feed list is a responsive 2-column grid with tighter cards — verdict + ~10 items fit one viewport on a desktop display.
- Verdict row gained a `Spine (NOW)` jump for direct comparison against the Shipping Spine.

### Safety (unchanged posture)

- Still no LLM calls, no external crawling, no cron, no writes, no agent launches from the feed.
- The only new process interaction is the read-only `nvidia-smi` GPU query in `systemInfo.ts` (mutates nothing, degrades to null when absent), consistent with existing read-only `git` probes in `repoScanner.ts`.

### Validation

- `npm run lint`: passed.
- `npm run build`: passed; `/api/mazos/system` present in route manifest.
- Local `GET /api/mazos/system`: 200, `local=true`, real VRAM readings.
- Local `GET /api/mazos/feed`: 200, ranked items, verdict intact.

## Next Improvements

1. Add read/mute state in `data/mazos/feed-state.json` only after v1 proves useful.
2. Add Proof Receipts as first-class feed items.
3. Add a prompt-only "summarize this feed" action before any automatic LLM integration.
4. Thumbs up/down per item feeding a static per-type weight file — cheap personal ranking without any model.
