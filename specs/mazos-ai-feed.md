# Spec: MAZos AI Feed

Generated: 2026-07-05. Source: `MAZOS_AI_FEED_RESEARCH_PROMPT.md`, MAZos audit, and a short prior-art pass across Linear Inbox, GitHub Notifications, Slack Activity, Devin session UI notes, and OpenHands trajectories.

## Mission

Add a compact AI Feed to MAZos that answers one question in one viewport:

**What changed since I last looked, and does it change what should ship next?**

This is not a social feed, generic activity log, chat stream, or decorative dashboard. It is an evidence-first triage strip for agent outputs, repo/product signals, intake arrivals, knowledge updates, decisions, and shipping-spine changes.

## Recommendation

Build v1 as a **new `FEED` tab inside the existing dashboard**, powered by deterministic aggregation in `src/lib/mazos/feed.ts` and served by `GET /api/mazos/feed`.

Do **not** add Claude/API summarisation or external RSS/web crawling in v1. First make local evidence dependable. Add a separate `/feed` page only if the tab proves too dense after v1.

## Prior Art Notes

- Linear Inbox treats updates as a triage inbox, not a timeline; steal read/unread, action focus, and compact issue context.
- GitHub Notifications supports filters and notification triage; steal source/type filters and a clear "requires attention" lane.
- Slack Activity consolidates mentions, replies, app pings, and reminders; steal the unified catch-up view, but avoid Slack-style noise.
- Devin emphasizes continuing from agent output and session handoff; steal "jump back into the session/work item" and handoff continuity.
- OpenHands exposes agent trajectories/event logs; steal event-log shape and deterministic replay, not autonomous execution.

## Feed Item Ranking

Rank by shipping impact, not recency alone.

| Rank | Item type | Source | Why it matters |
|---:|---|---|---|
| 1 | Decision opened/resolved | `data/mazos/decisions.jsonl` | Human gates can unblock or redirect agent work. |
| 2 | Shipping Spine verdict change | `/api/mazos/shipping-spine` recompute | Directly changes what ships next. |
| 3 | Run failure/success | `data/mazos/runs/*.jsonl` or run log store | Failed checks/actions need immediate triage; successful checks create proof. |
| 4 | Stale work finding | repo scan + `staleRadar.ts` | Dirty/unpushed/stuck branches create hidden risk. |
| 5 | Ship-log commit | `buildShipLog()` | Shows product movement and proof of shipped work. |
| 6 | Intake queue arrival | `data/mazos/ingest-queue.jsonl` | New source may change research/product context. |
| 7 | OpenWiki page/capture change | `GET /api/mazos/openwiki` | Knowledge changed; useful for agents, lower urgency unless tied to a product. |
| 8 | External RSS/web signal | future only | Useful later, but v1 should not call external APIs. |

Score formula v1:

`score = baseByType + moneyWeight + safetyWeight + freshnessWeight + blockerWeight + evidenceWeight`

Defaults:

- decision open: `95`
- shipping verdict changed: `90`
- run failed: `85`
- stale critical: `80`
- ship commit: `65`
- intake arrival: `55`
- OpenWiki update: `45`
- generic info: `30`

Cap at `100`. Sort by `requiresAttention desc`, then `score desc`, then `createdAt desc`.

## Item Schema

```ts
type FeedItem = {
  id: string;
  createdAt: string;
  updatedAt?: string;
  type:
    | 'decision'
    | 'shipping-spine'
    | 'run'
    | 'stale-work'
    | 'ship-log'
    | 'intake'
    | 'openwiki'
    | 'system';
  source: string;
  product?: 'JobFilter' | 'Recall' | 'OpenFlowKit' | 'MAZos' | 'Vault' | 'OpenWiki';
  title: string;
  summary: string;
  whyItMatters: string;
  nextAction: string;
  evidence: string[];
  evidencePaths: string[];
  safety: 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  score: number;
  requiresAttention: boolean;
  status: 'new' | 'active' | 'resolved' | 'muted';
  href?: string;
  copyPrompt?: string;
};

type FeedResponse = {
  generatedAt: string;
  mode: 'local-bridge' | 'hosted-fallback' | 'local';
  verdict: {
    changedWhatShipsNext: boolean;
    headline: string;
    nextAction: string;
    topItemId: string | null;
  };
  filters: {
    products: string[];
    types: string[];
    attentionCount: number;
  };
  items: FeedItem[];
  degraded: boolean;
  warnings: string[];
};
```

## Storage / Ingestion / Placement Options

| Option | Storage | Ingestion | Placement | Pros | Cons | Decision |
|---|---|---|---|---|---|---|
| A | Recompute-on-request only | Aggregate existing logs/APIs on `GET` | New `FEED` tab | Smallest diff, works with hosted fallback, no new write path, safest v1 | No read/unread persistence | **Use for v1** |
| B | `data/mazos/feed.jsonl` | Append from decisions/runs/ingest/openwiki actions | New `FEED` tab | Enables read/unread and history | More write paths; hosted read-only complexity | v1.5 |
| C | Supabase | API writes every event | `/feed` page | Hosted persistence, multi-device | New auth/env/DB surface; overkill now | Later if hosted feed needs real state |
| D | Vercel KV/Blob | API writes feed snapshots | `/feed` page | Better hosted support than local JSONL | Another vendor/storage dependency | Later only if Supabase is rejected |
| E | External RSS/web cron | Scheduled pollers | NOW panel | Can surface market signals | Violates v1 no-external/no-scheduler discipline | Not v1 |

## Data Layer

Create `src/lib/mazos/feed.ts` as a server-only deterministic aggregator. It should read existing sources and normalize them into `FeedItem[]`.

Sources for v1:

- `buildShippingSpine()` for verdict/top product rows.
- `readDecisions()` or exported fold helper from `decisions.ts`.
- `buildShipLog()` for commits.
- `scanRepos()` + `computeStaleFindings()` for stale work.
- ingest queue file at `INGEST_QUEUE`.
- run history via existing run log helper if exported; otherwise add a tiny read helper in feed module.
- `getOpenWikiStatus()` for counts/latest page signals, but treat failures as warnings.

Persistence:

- v1: no writes. Recompute on every `GET /api/mazos/feed`.
- Optional snapshot write may mirror Shipping Spine pattern only if useful:
  - write `data/mazos/feed-latest.md` in `try/catch`;
  - do not fail hosted Vercel if fs is read-only.
- Do not create `feed.jsonl` in v1 unless implementing read/mute state.

Hosted behavior:

- If local bridge is unavailable, hosted API still returns a degraded feed from whatever repo/static/server-readable data it can compute.
- `degraded: true` and `warnings[]` must explain missing local paths instead of throwing.

## API Contract

Add `src/app/api/mazos/feed/route.ts`.

`GET /api/mazos/feed`

Query params:

- `limit` optional, default `12`, max `30`.
- `product` optional.
- `type` optional.
- `attentionOnly` optional boolean.

Response: `FeedResponse`.

Rules:

- Never mutate state on `GET`.
- Never execute shell.
- Never call external APIs.
- Catch per-source failures and return partial feed with warnings.
- Use stable IDs: `${type}:${source}:${hashOrTimestamp}`.

Future `POST /api/mazos/feed` is reserved for read/mute state, not v1.

## UI Placement

Add `FEED` to the main dashboard `TABS` array in `src/app/page.tsx`.

Rationale:

- The feed is a cockpit-level catch-up view, not a separate workflow like `/sessions` or `/openwiki`.
- It should sit one click away from NOW and PROJECTS.
- A dedicated `/feed` page would be cleaner architecturally but adds navigation weight before the product shape is proven.
- Do not place it under NOW; Shipping Spine must remain first-viewport and decision-focused.

FEED tab layout:

- Top panel: `AI Feed Verdict`
  - headline
  - changed what ships next? yes/no
  - next action
  - top item copyable prompt
- One compact feed list, max 12 visible items.
- Type/product filter chips.
- Attention-only toggle.
- Each item shows:
  - type + product + safety badge
  - title
  - one-line summary
  - why it matters
  - next action
  - evidence count
  - buttons: `Evidence`, `Copy Prompt`, optional `Open`

Rendering constraints:

- Use existing `Panel`, `SafetyBadge`, `CopyBlock`, modal pattern, `ghost`/`primary`/`tag`/`finding` styles.
- All client fetches must use existing `mazosFetch()`.
- Keep new CSS tiny: only feed-specific grid/list classes if existing classes cannot cover it.

## AI Ranking Approach

v1 is deterministic. Do not call Claude/OpenAI.

The "AI" in v1 means agent-oriented synthesis:

- collapse multiple system signals into one ranked feed;
- explain why each item matters;
- generate copyable agent prompts from evidence;
- highlight whether the Shipping Spine changed.

Future v2 may add model summaries only after:

- feed item schema has stabilized;
- users mark items useful/not useful;
- local evidence coverage is reliable;
- cost and privacy boundaries are explicit.

If v2 uses an LLM, default to a prompt-only "summarize this feed" button before any automatic calls.

## Safety Notes

- Respect `config/control-panel.yaml`: `safe_mode: true`, `allow_shell: false`, `allow_push: false`, `allow_destructive: false`.
- Feed must not run agents, start loops, push code, scrape private content, or call external APIs.
- Every action is copyable prompt, local link, or evidence modal.
- Safety ceiling for v1 is L2, except Git/PR handoff prompts can be labeled L3 when they instruct a human/agent to prepare a branch/PR.
- Hosted Vercel must degrade gracefully without bridge access.

## Files To Create / Modify

Line budgets are intentionally small.

- Create `src/lib/mazos/feed.ts` (~220 lines): aggregation, schema, ranking, source adapters, prompt generation.
- Create `src/app/api/mazos/feed/route.ts` (~35 lines): parse query params, return `buildFeed()`.
- Modify `src/app/page.tsx` (~80 lines): add `FEED` tab, state loader, filter UI, feed panel/list, modal actions.
- Modify `src/app/globals.css` (~20 lines): feed list/card/filter styles only if existing classes are insufficient.
- Optional modify `src/lib/mazos/decisions.ts` (~10 lines): export a read helper if feed should avoid duplicating JSONL fold code.
- Optional modify `src/lib/mazos/logStore.ts` (~10 lines): export run-history read helper if not already available.
- Update `README.md` (~10 lines): document `/api/mazos/feed` and FEED tab.
- Add `MAZOS_AI_FEED_REPORT.md` (~60 lines): changed files, validation, safety notes, next improvements.

Do not touch unrelated branches, submodules, generated data, or external agent-source code.

## Done Criteria

- `GET /api/mazos/feed` returns `FeedResponse` locally with at least shipping-spine, stale-work, ship-log, decision, ingest, and OpenWiki-derived items when data exists.
- FEED tab loads through `mazosFetch()` and remains usable on hosted Vercel without local bridge.
- Feed is readable in one viewport: verdict + top 8-12 items, no decorative cards.
- Every item has `whyItMatters`, `nextAction`, `evidence`, `safety`, and `score`.
- Top feed item aligns with or explicitly explains divergence from Shipping Spine.
- No shell execution, no push, no destructive action, no external API call.
- `npm run lint` passes.
- `npm run build` passes.
- Manual checks:
  - `http://127.0.0.1:3046/api/mazos/feed`
  - `http://127.0.0.1:3046/` FEED tab
  - hosted `/` with bridge off still renders a degraded feed rather than crashing.

## Non-Goals

- No autonomous agent runner.
- No background cron.
- No external RSS/web crawling.
- No Supabase/KV/Vercel Blob in v1.
- No generic chat feed.
- No full notification center with read/unread sync.
- No new dependency unless unavoidable.

## Build Prompt For Next Agent

You are implementing the MAZos AI Feed v1 from `specs/mazos-ai-feed.md`.

Build the smallest useful version: deterministic `GET /api/mazos/feed`, `src/lib/mazos/feed.ts`, and a `FEED` tab in `src/app/page.tsx`. Aggregate existing MAZos evidence only: Shipping Spine, decisions, runs, ship log, stale radar, ingest queue, and OpenWiki status. Do not call external APIs or LLMs. Do not execute shell. Use `mazosFetch()` on the client. Degrade gracefully on hosted Vercel without the local bridge. Validate with `npm run lint`, `npm run build`, local API check, and manual FEED tab check. Update README and add `MAZOS_AI_FEED_REPORT.md`.
