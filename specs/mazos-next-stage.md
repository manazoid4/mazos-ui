# Spec: MAZos Next Stage — Loop Engineering + Declutter + 5 Features

Generated: 2026-07-01. Source: MAZOS NEXT STAGE BUILD PROMPT SHEET + web research
(Ralph Wiggum loop, loop-engineering stop conditions/budgets/human gates).

## Mission
Make MAZos lighter and execution-focused. Every screen answers: what matters now,
why, what evidence, what exact next action, what safety level, what needs manual handling.
No bloated dashboard. Safety defaults stay: safe_mode, no shell, no push, no destructive.

## R1 — Declutter: tabbed cockpit
- Single top-level tab bar: `NOW` / `LOOPS` / `PROJECTS` / `INTAKE` / `SYSTEM`.
- Header (clock + repo/dirty/service stats) always visible.
- Tab assignment:
  - NOW: What Now ranking, Loop status strip (compact), Stale Work Radar summary, Last Signal.
  - LOOPS: Loop Engineering Deck (R2) + Decision Inbox (R7).
  - PROJECTS: Project Command Cards, Latest Project Work, Repo Command Centre, Handoff Generator, Context Packs (R4), Ship Log (R5).
  - INTAKE: Source Intake, Vault Intelligence, Tool Router.
  - SYSTEM: Ops Radar, Action Matrix, Run History.
- Active tab persisted to localStorage. No panel appears in two tabs.

## R2 — Loop Engineering Deck (headline feature)
- New lib `src/lib/mazos/loopEngine.ts` + API `src/app/api/mazos/loops/route.ts`.
- Loop definition: id, name, goal, promptTemplate, successCondition (completion promise),
  maxIterations, budgetMinutes, noProgressStop (halt after N iterations without change),
  humanGates[], safetyCeiling (L1–L5), owner agent (Hermes/Codex/Claude).
- Built-in loop templates (seeded, editable state not required):
  1. Daily Triage L1 — report-only, 1 iteration/day, success = 3 priorities + blocker + next action delivered.
  2. PR Babysitter — watch open PRs/unpushed branches until merged or blocked; gate: merge needs human.
  3. Build Doctor — rebuild until green; success = exit 0; max 5 iterations; no-progress stop 2.
  4. Intake Queue Drainer — process ingest-queue.jsonl until empty; gate: auth/ToS items go to Decision Inbox.
  5. Ship Log Updater — collect what shipped across repos; success = shiplog written.
- Loop state persisted at `data/mazos/loops.json`; every event appended to `data/mazos/loop-runs.jsonl`.
- Loop card shows: status (idle/running/gated/stopped/complete), iteration i/max, budget used/total,
  stop conditions, safety ceiling badge, last event summary, stop reason when stopped.
- Buttons per loop:
  - `COPY LOOP PROMPT` — generates full Ralph-style runner prompt: same-prompt iteration,
    completion promise, max-iteration cap, budget cap, no-progress stop, human-gate list,
    forbidden actions from safety ceiling (reuses handoff forbidden rules), "stop and ask" rule.
  - `START` / `LOG ITERATION` (one-line summary input) / `COMPLETE` / `STOP` (reason: done, no-progress, budget, manual) / `GATE` (sends item to Decision Inbox).
- MAZos never executes loops itself; it is the control tower: prompts out, evidence in.

## R3 — Command Palette (Ctrl+K)
- Global palette: fuzzy-search actions (all registry buttons), loops, tabs, projects.
- Enter runs the action / switches tab / opens loop. Esc closes. Click-outside closes.
- Keyboard: Ctrl+K or `/` opens; arrows navigate; shows safety badge per action row.

## R4 — Context Pack generator (Headroom-inspired)
- New lib `src/lib/mazos/contextPack.ts` + API `src/app/api/mazos/context-pack/route.ts?project=X`.
- Compact markdown pack per project: repo path, branch, latest commit, dirty groups summary,
  blocker, next best action, verify commands, top 3 vault doctrine lines, evidence paths.
- Hard cap ~60 lines. Button on each Project Card: `CONTEXT PACK` → modal with copy button;
  also saved to `data/mazos/context-packs/<project>-<date>.md`.

## R5 — Ship Log (Ghost/Plausible-inspired)
- New lib `src/lib/mazos/shipLog.ts` + API `src/app/api/mazos/shiplog/route.ts`.
- Reads last 7 days of commits from every existing priority repo (read-only git log).
- Output: per-day grouped "what shipped" markdown + simple counters (commits today,
  commits 7d, repos active, runs ok/fail from run logs). No tracking, local only.
- Panel with `COPY PUBLISHABLE UPDATE` (markdown for Obsidian/GitHub) and refresh.

## R6 — Stale Work Radar
- Extend repo scan: per repo compute staleness findings: unpushed commits, dirty files,
  last commit age > 72h with dirty tree, branch != main with no upstream.
- Each finding: severity (info/warn/critical), evidence (counts/branch), exact next command,
  one-click `BABYSIT PROMPT` (pre-filled PR babysitter loop prompt for that repo).
- Compact strip on NOW tab (top 3 findings) + full list on PROJECTS tab.

## R7 — Decision Inbox (Stop & Ask human gates)
- New lib `src/lib/mazos/decisions.ts` + API `src/app/api/mazos/decisions/route.ts`.
- Item: id, createdAt, source (loop id/handoff/manual), question, context, options,
  status (open/approved/denied/answered), resolution, resolvedAt.
- Loops' GATE button and intake ToS boundaries append here. Manual add form (question + context).
- UI: open items count badge on LOOPS tab; per item Approve / Deny / Answer (free text);
  resolving generates a copyable "resolution prompt" telling the agent the human decision.
- Persisted `data/mazos/decisions.jsonl` (append events; state derived from last event per id).

## Non-goals
- No agent execution engine, no schedulers, no external API calls, no auth flows,
  no imports of external/agent-sources code, no new heavy dependencies.

## Acceptance
- `npm run build` passes.
- All new buttons either work, are disabled with reason, or emit a manual prompt.
- Everything read-only except writes to `data/mazos/*` (L2 ceiling).
- Existing panels/actions keep working; nothing unrelated reverted.
