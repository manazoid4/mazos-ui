# Deep Research: MAZos Usefulness Audit

Date: 2026-07-06
Project: MAZos
Baseline: `main` at `ae50e23`

## Question

What is useful in MAZos right now, what is weak, and what is not useful enough to keep as a first-class surface?

## Method

Compared MAZos current UI/modules against the research criteria from workflow automation, coding-agent products, and loop-engineering:

- Does it produce a clear decision or next action?
- Does it use current source-of-truth context?
- Does it attach evidence paths or receipts?
- Does it have a safety level or human gate?
- Does it reduce repeated founder/agent work?
- Does it map to a product line, not a random widget?

## High-Value Surfaces

### Loop Factory

Current files:

- `src/lib/mazos/loopFactory.ts`
- `src/lib/mazos/loopEngine.ts`
- `src/app/api/mazos/loop-factory/route.ts`
- `src/app/api/mazos/loops/route.ts`
- `src/app/page.tsx`

Why useful:

- Directly matches the user's repeated need: "research competitors, copy what works, improve our projects."
- Already has readiness scoring, pattern classification, safety ceilings, evidence required, and custom loop persistence.

Weakness:

- `LoopDef` lacks explicit trigger, source policy, latest-GitHub rule, actor/verifier split, receipt schema, and cost/source trust scoring.

Decision:

- Keep and promote.
- Next: Loop Doctor + LoopSpecV2.

### Feed / Inbox

Current files:

- `src/lib/mazos/feed.ts`
- `src/lib/mazos/feedState.ts`
- `src/app/api/mazos/feed/route.ts`

Why useful:

- It already scores work and groups items by decision, stale work, failed checks, shipping spine, openwiki, system, and intake.
- It attaches evidence and generates a scoped prompt.

Weakness:

- The feed is only useful if it becomes a loop findings inbox. Generic feed items are easy to ignore.

Decision:

- Keep, but rename/shape toward Loop Inbox.

### Flight Recorder

Current files:

- `src/lib/mazos/flightRecorder.ts`
- `src/app/api/mazos/flight-recorder/route.ts`

Why useful:

- It has the right philosophy: replay actual logged events and mark gaps as "not verified."
- This is exactly what loop receipts need.

Weakness:

- It is passive and incomplete until every loop/action writes receipts.

Decision:

- Keep and expand into receipt viewer.

### Context Map / Source Receipts

Current files:

- `src/lib/mazos/sourceReceipts.ts`
- `src/app/api/mazos/context-map/route.ts`

Why useful:

- Strong source-of-truth surface.
- Gives agents "read first" receipts and missing context warnings.

Weakness:

- Does not yet include live external/latest GitHub snapshots for competitor/repo research.

Decision:

- Keep.
- Add GitHub/web/source snapshot receipts.

### Shipping Spine / Task Gate / Morning Brief

Current files:

- `src/lib/mazos/shippingSpine.ts`
- `src/lib/mazos/taskGate.ts`
- `src/lib/mazos/morningBrief.ts`

Why useful:

- They turn scattered state into ranked action and safer launch prompts.
- They match the cockpit promise better than raw dashboards.

Weakness:

- Too many separate panels can blur the main decision.

Decision:

- Keep as backend intelligence.
- UI should consolidate them into "What should ship next?" and "What loop should run next?"

## Medium-Value Surfaces

### Ship Log

Why useful:

- Durable shipped-work summary is useful for session notes and product memory.

Weakness:

- As a standalone panel it is less important than loop receipts.

Decision:

- Keep as receipt/session output, not a major first-class UI surface.

### Stale Work Radar

Why useful:

- Useful when it produces a concrete rescue/close action.

Weakness:

- Can become noise if it only reports dirty branches without recommending a loop.

Decision:

- Fold into Loop Doctor and GitHub Pulse Pack.

### Tool Router

Why useful:

- Helps pick skills/tools for a task.

Weakness:

- It is too meta unless connected to a loop or mission plan.

Decision:

- Demote standalone UI.
- Use internally inside Loop Factory, Context Map, and Runtime Export.

### Runtime Safety Console

Why useful:

- Good safety framing for agent work.

Weakness:

- It is not actionable enough unless tied to a loop/run.

Decision:

- Keep but make it contextual: shown inside Loop Simulator and Task Gate.

## Low-Value Or Under-Specified Surfaces

### Action Matrix

Problem:

- A grid of actions is less useful than a ranked loop or prompt.
- It can duplicate Feed, Task Gate, and Project Cards.

Decision:

- Candidate to demote or hide behind command palette.

### Raw system strip

Problem:

- CPU/RAM/GPU is only useful when it changes the action, such as "do not run local heavy agent now."

Decision:

- Keep as a small local-only guard.
- Do not expand it into a major dashboard.

### Intake UI

Problem:

- Intake is useful only when it drains into a loop and produces receipts.

Decision:

- Keep, but tie it directly to Intake Drainer and Competitor Intelligence Pack.

## Product-Level Diagnosis

The useful core is already visible:

- Source receipts.
- Decision gates.
- Flight recorder.
- Loop Factory.
- Feed scoring.
- Shipping spine.

The weakness is not lack of panels. It is lack of one product grammar tying them together.

That grammar should be:

> source -> loop spec -> simulation -> human gate -> run/agent handoff -> receipt -> next decision

## Recommended Cuts / Merges

1. Merge Feed and Loop findings into "Loop Inbox."
2. Merge Tool Router into Loop Factory and Context Map.
3. Merge Ship Log into Receipts and Session Notes.
4. Move Action Matrix into command palette.
5. Keep System Strip tiny and only show pressure warnings.

## Next Implementation PR

Build Loop Doctor:

- Add `LoopUsefulnessAudit` type.
- Audit existing loop templates and custom loops.
- Score:
  - trigger clarity
  - source policy
  - latest-GitHub requirement
  - evidence quality
  - verifier separation
  - safety level
  - stop condition
  - product impact
- Show grade in Loop Factory / Loop Engineering Deck.
- Flag loops as `keep`, `revise`, `merge`, or `remove`.

This is the highest-leverage next feature because it prevents MAZos from becoming a pile of dashboards and turns research into a product-quality gate.

