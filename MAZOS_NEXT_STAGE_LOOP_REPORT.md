# MAZos Next-Stage Loop Report

Date: 2026-07-06
Branch: `agents/next-stage-loop`

## Starting Point

Latest merged work at loop start was PR #22:

- Feed Operator Inbox with lanes and local item state.
- Flight Recorder v1 from logged runs/gates/preflights/mission plans/loops.
- Morning Command Brief inside the FEED UI.
- Explainable `scoreBreakdown`, evidence quality, and premium UI direction.

This loop avoided rebuilding those features and added the next missing operating layer.

## What Added

- Server-side Morning Brief API: `GET /api/mazos/morning-brief`.
- Source Receipts / Context Map API: `GET /api/mazos/context-map`.
- Agent Runtime Registry API: `GET /api/mazos/agent-runtimes`.
- NOW cockpit panels for the server brief and context receipts.
- SYSTEM cockpit panel for agent runtime safety flags and recommended runtime.

## Product Reason

MAZos should be more than a dashboard. The useful moat is that every agent session can start with:

1. What matters now.
2. Which sources to read first.
3. Which runtime should handle the work.
4. What safety ceiling applies.
5. What evidence must be quoted before claiming done.

## Safety

- No shell execution from these panels.
- No LLM calls.
- No external crawling.
- No autonomous agent launch.
- Hosted mode can use the local bridge when available and otherwise degrades through existing local-path limitations.

## Changed Files

- `src/lib/mazos/morningBrief.ts`
- `src/lib/mazos/sourceReceipts.ts`
- `src/lib/mazos/agentRuntimes.ts`
- `src/app/api/mazos/morning-brief/route.ts`
- `src/app/api/mazos/context-map/route.ts`
- `src/app/api/mazos/agent-runtimes/route.ts`
- `src/app/page.tsx`
- `src/app/globals.css`
- `README.md`

## Validation

- `npm run lint`: passed.
- `npm run build`: passed. Existing Next/Turbopack workspace-root and OpenWiki tracing warnings remain non-fatal.
- `GET http://127.0.0.1:3052/api/mazos/morning-brief?project=MAZos`: 200.
- `GET http://127.0.0.1:3052/api/mazos/context-map?project=MAZos`: 200.
- `GET http://127.0.0.1:3052/api/mazos/agent-runtimes?task=improve%20mazos%20context`: 200.
- `GET http://127.0.0.1:3052/`: 200.

## Next Loop

1. Add a dedicated `/context` page with saved project views and missing-knowledge cleanup.
2. Let Flight Recorder link runtime recommendations and context receipts to each session.
3. Add receipt usefulness feedback so MAZos learns which sources actually helped.

## Iteration 2 Addendum

Branch: `agents/task-gate-context-receipts`

After PR #23 merged, this loop connected Source Receipts directly into Task Gate mission planning:

- `createMissionPlan()` now builds a Context Map for the target repo/project.
- Saved mission plan Markdown includes Source Receipts and a copyable Context Prompt.
- The generated Hermes prompt includes a `SOURCE RECEIPTS - READ BEFORE ACTING` block and rules for quoting receipts, stopping on contradictions, and protecting sensitive local/vault paths.
- `/sessions` shows Source Receipts and the Context Map prompt on generated mission plans.

Validation:

- `npm run lint`: passed.
- `npm run build`: passed with the existing non-fatal Next/Turbopack warnings.
- `POST http://127.0.0.1:3053/api/mazos/mission-plan`: 200, returned 10 source receipts, and `hermesPrompt` included `SOURCE RECEIPTS`.
