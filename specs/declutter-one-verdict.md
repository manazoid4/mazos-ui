# Spec: declutter-one-verdict

Goal: MAZos feels like a command centre, not a museum. One verdict pipeline, half the panels, receipts-gated loops. No new features, no new dashboards, no new routes.

Branch: `agents/declutter-one-verdict` -> PR to main.

## R1 — One Verdict pipeline
- `src/lib/mazos/feed.ts`: feed verdict headline/nextAction derive from the shipping-spine item when present (`Ship next: <product> — <action>`). Only if a non-spine item outranks it does the top item take the headline, and `changedWhatShipsNext` stays true.
- `src/lib/mazos/morningBrief.ts`: `headline` and `shipNext` come from the feed's spine item (spine verdict), not whatever item happens to be top. `safestNextPrompt` prefers the spine handoff prompt.

## R2 — NOW tab = SpinePanel only
- `src/app/page.tsx`: remove `ServerMorningBriefPanel` component and its render. Fold into `SpinePanel`: brief `needsYou` list (max 4), `avoidToday` line, Copy Brief button (brief markdown modal). Add ship-log "Copy publishable update" button to SpinePanel footer chips.
- Remove the `/focus` footer button from SpinePanel.

## R3 — WORK tab 10 → 5 panels
Keep: Project Command Cards, Loop Factory, Loop Engineering Deck, Decision Inbox, Agent Prep.
- Remove renders: `LoopDoctorPanel` (aggregate; per-card doctor badges stay; move the "avg/keep/revise/merge/remove" one-liner into the Loop Engineering Deck badge), Ship Log panel (copy button moved to NOW), Stale Work Radar panel (feed covers stale), Repo Command Centre (Project Cards cover repos).
- New `AgentPrepPanel`: one panel with a chip switcher (Handoff | Context | Router | Runtime) rendering the existing `HandoffPanel`, `ContextMapPanel`, `ToolRouterPanel`, `RuntimeSafetyPanel` bodies one at a time. Remove `ToolRouterPanel` from INTAKE and `RuntimeSafetyPanel` from SYSTEM.
- Remove Vault Intelligence panel from INTAKE (API stays).
- Delete now-unused components/imports (StaleRow, staleRadar client imports if unused, etc.). Keep `computeStaleFindings` only if still used by header summary.

## R4 — Feed lanes 9 → 4, watch tamed
- `src/lib/mazos/feed.ts`: collapse lanes at build time: `failed-checks`+`system-pressure` → `blocked`; `stale-work`+`knowledge-gaps` → `watch`. Emitted lanes: `needs-decision`, `blocked`, `ready-to-ship`, `watch` (+ `done` for parked).
- Watch-lane items are born `seen`, never `unread` (unreadCount counts only action lanes).
- Cap live `watch` items at 3 highest-score in the response.
- `src/app/page.tsx`: `LANES` list → 4; MorningBrief (inbox) stats use the 4 lanes.

## R5 — Loops: receipts enforced, pattern backfilled
- `src/app/api/mazos/loops/route.ts`: reject `complete` (400, clear message) unless the loop has ≥1 prior `iteration` event with a non-empty summary (evidence).
- Same route GET/POST mapping: if a loop has 0 receipts and `startedAt` older than 3 days with status running/gated, downgrade `audit.decision` `keep`→`revise` and prepend gap "No receipts logged — loop is running without evidence."
- `data/mazos/custom-loops.json`: set `pattern: "research-intelligence"` on the JobFilter competitor loop.

## R6 — Hide empty radar, kill /focus, move root reports
- `src/app/research/page.tsx`: render Competitor Radar section only when `radar.snapshots.length > 0`.
- Delete `src/app/focus/`, `src/app/api/mazos/focus/`, `src/lib/focusStore.ts`. Remove remaining `/focus` references.
- `git mv` root `MAZOS_*.md` (10 files) → `docs/reports/`. App code must not read them from root (verified: research console reads `research/mazos`).

## Verify
- `npm run build` passes.
- `curl /api/mazos/feed` → lanes ⊆ {needs-decision, blocked, ready-to-ship, watch, done}; ≤3 live watch items; unread excludes watch; verdict headline matches spine unless outranked.
- `curl /api/mazos/morning-brief` shipNext matches spine verdict.
- POST loops complete without iteration evidence → 400.
- `/research` renders without empty radar cards; `/focus` 404s.

## Forbidden
- No new routes, no new dashboards, no styling overhauls, no new deps.
