# MazOS AI Feed — Research-Further Prompt

Copy-paste this entire file to a research agent. It is self-contained: the full MazOS audit (2026-07-05) is inlined below.

## Mission

Research and spec how to add an **AI feed** feature to MazOS. The feed should surface a continuously updated stream of relevant items (agent outputs, ingested sources, repo/product signals, knowledge updates) inside the MazOS cockpit. Do research and produce a build-ready spec — do NOT write code yet.

## Context

- Repo: https://github.com/manazoid4/mazos-ui (local: `C:\Users\manaz\Projects\mazos-ui`)
- Live: https://mazos-command-centre.vercel.app (deploys `main`; local app on 3046, bridge on 3047)
- Known feature anchor: Shipping Spine at `/api/mazos/shipping-spine`
- Full audit: inlined below (§ Audit). Key files: `src/app/page.tsx`, `src/lib/mazos/shippingSpine.ts`, `src/lib/mazos/playbooks.ts`, `src/app/api/mazos/ingest/route.ts`, `src/lib/mazos/paths.ts`, `scripts/mazos-local-bridge.mjs`, `config/control-panel.yaml`, `docs/MAZOS_MARKET_BREAKER_ROADMAP.md`

## Research Questions

1. **What should the feed contain?** Rank candidate item types by value to shipping velocity: run results, decision-inbox events, shipping-spine changes, ship-log commits, intake-queue arrivals, OpenWiki page changes, stale-radar findings, external signals (RSS/web). MazOS doctrine: every panel must answer "what should ship next and why" — no decorative panels (see Anti-Bloat rules in `docs/MAZOS_MARKET_BREAKER_ROADMAP.md`).
2. **Where does it live?** New tab in `page.tsx` `TABS` array vs. dedicated `/feed` page (precedent: `/sessions`, `/openwiki`) vs. NOW-tab panel under the Shipping Spine. Recommend one with rationale.
3. **Data layer.** MazOS has NO database — JSONL event logs + markdown snapshots under `data/mazos/`, unwritable on hosted Vercel (read-only fs; see `shippingSpine.ts:200-205` try/catch pattern). Evaluate: (a) local-only JSONL feed served via bridge, (b) Vercel KV/Blob, (c) Supabase, (d) recompute-on-request aggregation with no persistence. Weigh against the local-first + bridge architecture.
4. **Ingestion.** How do new items enter? Extend `/api/mazos/ingest` queue, add a `data/mazos/feed.jsonl` appender library (`src/lib/mazos/feed.ts` + `src/app/api/mazos/feed/route.ts`), poll existing JSONL logs and merge, or cron? Note: `allow_shell: false` safety model — MazOS never executes; prompt-first.
5. **AI layer.** Where does intelligence come in — ranking/summarising items (Claude API? which model, cost), or purely deterministic aggregation v1? Respect safety levels L1–L3 and the human-gate model.
6. **Rendering.** Follow existing conventions: `Panel` wrapper, `CopyBlock`, `SafetyBadge`, modal via `setModal`, `mazosFetch()` (bridge-first fetch), hand-rolled dark theme classes in `src/app/globals.css` (Tailwind installed but barely used). All new fetches MUST go through `mazosFetch`.
7. **Prior art.** Briefly survey how comparable "agent cockpit" feeds work (e.g. activity streams in Linear/GitHub notifications/Devin-style agent logs) for ranking + read/unread patterns worth stealing.

## Deliverables

1. A spec file `specs/mazos-ai-feed.md` (format compatible with the /spec → /build → /review loop): feature summary, item schema, storage decision, API contract, UI placement, ingestion flow, AI-ranking approach, safety notes, done criteria.
2. A short options table (storage × ingestion × placement) with a single recommendation.
3. Explicit list of files to create/modify with rough line budgets (ponytail discipline: smallest diff, reuse first).

## Constraints

- No scope creep: v1 feed must be readable in one viewport and answer "what happened since I last looked, and does anything change what ships next".
- Never violate `config/control-panel.yaml` safety flags (safe_mode, allow_shell:false, allow_push:false).
- Must degrade gracefully on hosted Vercel without the local bridge (same pattern as Shipping Spine).
- No tests exist today; spec should state a minimal verification plan (`npx tsc --noEmit` + manual route checks).

---

# Audit — MazOS, 2026-07-05 (full, inlined)

## (a) Current State Summary

- **Repo**: `C:\Users\manaz\Projects\mazos-ui` → github.com/manazoid4/mazos-ui. Next.js 16 / React 19 / TypeScript 6 / Tailwind 4 / zustand. Typecheck (`tsc --noEmit`) passes clean.
- **Checked-out branch at audit time**: `agents/openwiki-cockpit`, 1 commit ahead of main (`e3b00e6 feat: add OpenWiki cockpit`), pushed, open PR #15 awaiting merge.
- **Uncommitted**: untracked `data/` (runtime JSONL/state), `tsconfig.tsbuildinfo`, modified `research/mazos/latest-vault-scan.md`, dirty `external/agent-sources/penpot` submodule.
- **12 local branches**, all pushed; 0 open issues; only PR #15 open.
- **Vercel**: project `mazos-command-centre`, live at https://mazos-command-centre.vercel.app, deployed from main (`aca06d0`).
- **Identity**: local-first "Jarvis-lite" command cockpit for Maz + agents (Hermes/Codex/OpenCode). Deliberately prompt-first, never-executing: `config/control-panel.yaml` sets `safe_mode: true, allow_shell: false, allow_push: false`. Almost everything generates copyable prompts.

## (b) Recent Changes (last 2 weeks)

- **Jul 1**: Command-centre rebuild — tabbed cockpit (NOW/LOOPS/PROJECTS/INTAKE/SYSTEM), command palette (Ctrl+K), Loop Engineering deck, Decision Inbox, project status, Hermes external agent-source submodules + Tool Router.
- **Jul 2–3**: Vercel deployment prep; local bridge (`scripts/mazos-local-bridge.mjs`, 3047 → local app 3046, proxies only `/api/mazos/*`); auto-start scheduled task "MAZos Local Stack".
- **Jul 4**: Shipping Spine v1 (PR #11) — playbooks + spine API + first-viewport panel; fix for 500 on Vercel read-only fs (PR #13); Agent Task Gate + Mission Planner (`/sessions`, task scoring 0–100, safe/caution/danger); Market-Breaker roadmap doc.
- **Jul 5**: OpenWiki cockpit (`/openwiki` page + API, OpenWiki desktop app/SQLite integration) — PR #15, open, not yet on main/production.

## (c) Feature Inventory

Done & deployed (on main + live):

| Feature | Where | Notes |
|---|---|---|
| Shipping Spine | NOW tab panel + `GET /api/mazos/shipping-spine` | Flagship. Per-product row: objective, next action, blocker, owner, safety, handoff prompt. Live, 200. |
| Product Playbooks | `src/lib/mazos/playbooks.ts` | 4 hardcoded playbooks: JobFilter, Recall, OpenFlowKit, MAZos. |
| Loop Engineering Deck | LOOPS tab, `/api/mazos/loops` | Ralph-style loop templates (Daily Triage L1, PR Babysitter, Build Doctor…) with budgets/gates. MAZos never executes — copies runner prompts, human logs iterations. |
| Decision Inbox | LOOPS tab, `/api/mazos/decisions` | Stop-and-ask queue; approve/deny/answer → resolution prompt. JSONL event log. |
| Project Command Cards + Status | PROJECTS tab, `/api/mazos/project-status` | Git-evidence status for JobFilter/Recall/MAZos/Vault: commit, blocker, next action, dirty-file grouping. |
| Ship Log | PROJECTS tab, `/api/mazos/shiplog` | Commits today/7d across repos + publishable update markdown. |
| Stale Work Radar | NOW + PROJECTS, client-side `staleRadar.ts` | Dirty/unpushed findings → "babysit prompt". |
| Handoff Generator | PROJECTS tab, `handoff.ts` | Scoped Hermes/Codex briefs with safety level L1–L3 + verify commands. |
| Context Packs | `/api/mazos/context-pack` | Per-project markdown pack saved to `data/mazos/context-packs`. |
| Repo Command Centre | PROJECTS tab, `/api/mazos/repos` (`repoScanner.ts`) | Branch/dirty/unpushed/scripts per configured repo. |
| Source Intake | INTAKE tab, `/api/mazos/ingest` | URLs/PDFs → queue JSONL routed to Recall/Obsidian (processing is a manual prompt). |
| Vault Intelligence | INTAKE tab, `/api/mazos/vault` | Light Obsidian vault scan → doctrine/prompts/index files. |
| Tool Router | INTAKE tab, `/api/mazos/tool-router` | Keyword-routes tasks to external agent-source submodules (Headroom, Maxun, n8n templates, etc.). |
| Ops Radar | SYSTEM tab, `/api/mazos/health` | Pings localhost:3046/3029/3000 + paths. Hosted shows local services offline (expected). |
| Action Matrix + Run History | SYSTEM tab, `/api/mazos/action`, `/api/mazos/runs` | ~30 actions in `commandRegistry.ts`; mostly `prompt` handlers, a few whitelisted git/npm commands locally. |
| Command Palette | Ctrl+K overlay | Fuzzy actions/loops/projects/tabs. |
| Agent Task Gate | `/sessions`, `/api/mazos/task-gate` + `/api/mazos/mission-plan` | Preflight scoring (0–100) of agent tasks; improve/shrink prompt; mission planner. Live, 200. |
| Local Bridge | `scripts/mazos-local-bridge.mjs` | Hosted UI tries `http://127.0.0.1:3047` first, falls back to hosted API. BridgeBanner shows state. |
| Focus Sprint | `/focus`, `/api/mazos/focus`, `focusStore.ts` (zustand) | 45-min accountable sprint mode. |

Done but NOT deployed (PR #15): OpenWiki cockpit — `/openwiki` page + `GET/POST /api/mazos/openwiki` (OpenWiki app status, SQLite page counts, health score, knowledge gaps, copyable agent prompts).

Stubbed / half-done:
- Email digest (`/api/mazos/email`, `/api/mazos/email-digest`, Resend): `email.enabled: false`; dormant.
- Loops: STATE.md says "Last run: never" — infra built, never calibrated/used.
- Roadmap features 3–5 not built: Proof Receipts, Safe Action Capsules, Founder Revenue Radar.
- `.ralph/` state inconsistency (STATE says complete, prd.json pending).
- `install.ps1` / README port-9999 / Python prereq are legacy — app actually runs `next dev -p 3046`.
- No tests; "lint" is `tsc --noEmit` only.

## (d) Architecture Summary — relevant to adding an AI Feed panel

- **Framework**: Next.js 16 App Router under `src/app/`; each page is one big client component (`src/app/page.tsx` = 334 dense lines, tab-switched panels, inline function components). Pages: `/`, `/sessions`, `/focus`, `/openwiki` (PR #15).
- **Data fetching**: no React Query/SWR — plain `fetch` via `mazosFetch()` wrapper that tries the local bridge (127.0.0.1:3047) first when hosted on vercel.app, then falls back to hosted API. `useEffect`-on-mount + `useState`; zustand only for focus store.
- **API pattern**: one route per concern at `src/app/api/mazos/<name>/route.ts` (Node runtime, fs + child_process git reads). Pure logic in `src/lib/mazos/<name>.ts`; server-only modules read local fs; client-safe modules (safety, loopEngine, playbooks, staleRadar) imported by pages directly.
- **Persistence**: no database. Files under `data/mazos/` — JSONL event logs (runs, decisions, task-gate history, ingest queue) and markdown snapshots (shipping-spine.md, context packs, mission plans). Hosted Vercel fs is read-only; writes are try/catch-skipped (`shippingSpine.ts:200-205`).
- **Ingestion precedent**: INTAKE tab + `/api/mazos/ingest` queues URLs/files as JSONL for later agent processing.
- **Component conventions**: `Panel` (title/badge/children), `CopyBlock`, `SafetyBadge` (L1–L3), modal via `setModal({title, body})`, chips/ghost/primary classes. Styling = single hand-rolled dark theme `src/app/globals.css`; Tailwind 4 + shadcn installed but barely used (3 shadcn components).
- **Natural feed placement**: new tab in `TABS` in `page.tsx`, or NOW below Shipping Spine, or a `/feed` page; data layer = `src/lib/mazos/feed.ts` + `src/app/api/mazos/feed/route.ts` over `data/mazos/feed.jsonl`, fetched via `mazosFetch`. Tool Router + intake queue + vault scan are existing content sources to aggregate.
- **Env vars (names only)**: `MAZOS_BRIDGE_PORT`, `MAZOS_LOCAL_TARGET`, `RESEND_API_KEY`, `NOTIFY_EMAIL`, `EMAIL_FROM`, plus OS vars (`USERPROFILE`, `HOME`, `LOCALAPPDATA`).

## (e) Live Deploy Health (checked 2026-07-05)

| Route | Status |
|---|---|
| `/` | 200 |
| `/api/mazos` | 200 |
| `/api/mazos/shipping-spine` | 200 (read-only-fs fix works) |
| `/api/mazos/health` | 200 (local services offline from cloud — expected without bridge) |
| `/api/mazos/task-gate` | 200 |
| `/sessions` | 200 |
| `/openwiki` + `/api/mazos/openwiki` | 404 — only on PR #15 |

Deployed build = main (`aca06d0`).

## (f) Risks / Tech Debt

1. PR #15 unmerged — OpenWiki cockpit unshipped; branch README documents it as if live.
2. 10 stale agent branches — hygiene needed.
3. No persistence on hosted — all state is local Windows files; hosted degraded without bridge. Biggest architectural constraint for an AI feed (consider Supabase/KV or accept local-only).
4. Monolithic `page.tsx` — adding a feed panel inline worsens it; `/sessions` and `/openwiki` set the separate-page precedent.
5. Zero tests; lint = typecheck only (passing).
6. Hardcoded absolute Windows paths throughout, exposed via hosted API responses (low risk, known).
7. No secrets in code (src swept clean); Resend key env-based. No TODO/FIXME in src.
8. Heavy `external/agent-sources/*` submodules bloat repo; penpot dirty; `.vercelignore` mitigates deploys.
9. Dead/legacy artifacts: `install.ps1`, README port 9999/Python, empty `temp.json`, `.ralph/` mismatch, disabled email code.
10. Loops never run in anger; STATE.md flags calibration as top task.
