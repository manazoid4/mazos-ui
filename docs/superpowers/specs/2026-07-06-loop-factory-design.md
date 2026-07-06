# Loop Factory Design

Date: 2026-07-06
Source of truth: `origin/main` at `e79defd` / PR #26.

## Objective

Add a Loop Factory to MAZos that turns a plain-English operating goal into a reusable, reviewable loop template. The factory must improve the existing Loop Engineering Deck without reversing the UI declutter: it lives inside the `WORK` tab and does not add a new top-level tab.

## Product Rule

Loop Factory creates loop templates, not autonomous execution. MAZos remains prompt-first: prompts out, evidence in, human gates for risk.

## V1 Scope

- Generate a reusable loop draft from:
  - goal text
  - optional project
  - optional pattern
  - optional source list
- Score readiness before saving.
- Save approved custom loops to local flat JSON under `data/mazos/custom-loops.json`.
- Merge custom loops with existing built-in loop templates in `/api/mazos/loops`.
- Render a compact Loop Factory panel in `WORK` above the Loop Engineering Deck.
- Seed one first-class pattern: `research-intelligence`, used for competitor research loops.

## Loop Draft Shape

Loop drafts use the existing `LoopDef` shape:

- `id`
- `name`
- `goal`
- `promptTemplate`
- `successCondition`
- `maxIterations`
- `budgetMinutes`
- `noProgressStop`
- `humanGates`
- `safetyCeiling`
- `agent`

The factory response adds:

- `pattern`
- `readinessScore`
- `readiness`
- `warnings`
- `evidenceRequired`

## Pattern Rules

`research-intelligence` is selected when the goal includes competitor, market, research, emulate, copy, pricing, positioning, landing page, funnel, or alternatives.

Its generated loop should:

- Read only user-provided public URLs, source receipts, product playbook, and intake queue entries.
- Produce ideas to steal, ideas to reject, one ranked product move, evidence paths/URLs, and proof needed before acting.
- Gate any auth wall, ToS boundary, scraping, paid source, or external publishing.
- Default to `Hermes`, `L1`, 3 iterations, 45 minutes, no-progress stop 2.

## Readiness Score

Start from 100, subtract for missing or weak structure:

- empty goal: -35
- missing sources: -15
- missing success condition: -15
- missing human gates: -15
- no evidence requirement: -10
- max iterations over 10: -10
- budget over 120 minutes: -10
- safety above L2 for research loops: -10

Readiness:

- `ready`: score >= 80
- `needs-review`: score 50-79
- `unsafe`: score < 50

Only `ready` and `needs-review` drafts can be saved. `unsafe` drafts must be edited first.

## UI

Location: `WORK`, directly before the Loop Engineering Deck.

Controls:

- Goal textarea
- Project select/text field
- Pattern select (`auto`, `research-intelligence`, `daily-triage`, `pr-babysitter`, `build-doctor`, `intake-drainer`, `ship-log`)
- Sources textarea
- `Draft Loop`
- `Save Template`
- `Copy Runner Prompt`

Display:

- readiness score
- warning list
- generated loop summary
- evidence required
- generated prompt preview via existing `CopyBlock`

## API

`GET /api/mazos/loop-factory`

- Returns patterns and existing custom loop count.

`POST /api/mazos/loop-factory`

- `action: "draft"` returns a draft only.
- `action: "save"` saves the draft to `data/mazos/custom-loops.json` and returns merged draft metadata.

Hosted Vercel writes may fail due read-only filesystem. The API must catch write errors and return `ok:false` with HTTP 200 so the hosted UI degrades like existing feed-state writes.

## Non-Goals

- No scheduler.
- No autonomous execution.
- No crawling.
- No external API calls.
- No database.
- No new dependencies.
- No new top-level nav.

## Acceptance

- `npm run lint` passes.
- `npm run build` passes.
- Node tests for loop factory generation pass.
- WORK tab shows Loop Factory and existing loop cards.
- Saving a loop locally makes it appear in `/api/mazos/loops`.
- Hosted write failure degrades without crashing.
