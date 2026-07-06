# MAZos Loop Factory Product Line Research

Date: 2026-07-06
Project: MAZos
Scope: Turn the Loop Factory v1 into a product line for repeatable research, competitor analysis, repo improvement, verification, and personal operating loops.

## Source Of Truth

This brief uses the latest local `origin/main` for MAZos plus live GitHub repository metadata checked on 2026-07-06. GitHub pushes matter because agent tooling is moving quickly; stale blog-level advice is not enough.

## Live Repo Signals

| Repository | Stars | Forks | Last pushed UTC | Signal |
|---|---:|---:|---|---|
| n8n-io/n8n | 195436 | 59122 | 2026-07-06T19:46:58Z | Workflow automation is the mass-market shape: triggers, nodes, integrations, self-hosting, and visual control. |
| anomalyco/opencode | 182984 | 22673 | 2026-07-06T20:18:58Z | Coding agents are becoming command surfaces, not only chat surfaces. |
| OpenHands/OpenHands | 79639 | 10155 | 2026-07-06T19:39:02Z | Developer-agent workspaces need real files, shells, browser/actions, and reviewable outputs. |
| microsoft/autogen | 59535 | 8961 | 2026-04-15T11:59:09Z | Multi-agent orchestration has broad adoption, but current push velocity matters. |
| crewAIInc/crewAI | 55025 | 7729 | 2026-07-06T19:11:46Z | Role-based agent crews are a familiar mental model for users. |
| langchain-ai/langgraph | 36639 | 6143 | 2026-07-06T20:17:45Z | Durable state, graph control, and human interrupts are core production patterns. |
| openai/openai-agents-python | 27695 | 4262 | 2026-07-06T06:41:40Z | Handoffs, guardrails, tracing, and tool execution are now baseline agent runtime expectations. |
| mastra-ai/mastra | 25871 | 2371 | 2026-07-06T20:14:39Z | TypeScript-native agent/workflow frameworks matter for a Next.js product. |
| cobusgreyling/loop-engineering | 6177 | 793 | 2026-07-06T15:05:21Z | Loop engineering is quickly becoming a named practice with audit/init/cost primitives. |
| clawplays/ospec | 559 | 35 | 2026-06-25T07:15:12Z | Spec, plan, act, verify, evidence, and safety levels are the right shape for serious loops. |

## Research Takeaways

1. Loops are control systems, not prompts.
   Addy Osmani frames loop engineering as designing the system that prompts agents, with schedule, worktrees, skills, connectors, sub-agents, and persistent memory. This maps directly to MAZos: the product should design and govern loops, not only generate better prompts.

2. Human-in-the-loop is a first-class state.
   LangGraph interrupts pause execution, persist state, and resume from a thread pointer. MAZos should treat approvals, missing context, budget stops, and review requests as normal loop states rather than failures.

3. Durable evidence is more important than autonomy.
   Temporal's durable execution model is valuable because an event history doubles as recovery state and audit log. MAZos does not need Temporal yet, but every loop should produce a receipt: inputs, sources, actions, verification, costs, and open decisions.

4. Highly adopted workflow tools win through triggers and integrations.
   n8n and GitHub Actions show the same product lesson: a loop becomes useful when it has a trigger, scoped jobs/steps, and clear artifacts. MAZos Loop Factory should describe triggers even before it runs them.

5. The best agent loops separate maker and checker.
   Addy, OSpec, OpenAI Agents SDK, and production-agent guidance all point to handoffs, reviewers, guardrails, tracing, and evidence. A useful MAZos loop should name at least two roles: the actor and the verifier.

6. Safety levels beat vague autonomy.
   OSpec's L1/L2/L3 framing is the right user-facing language. MAZos should default to L1 report-only, graduate to L2 assisted local changes, and require explicit human approval before PRs or writes.

7. Token, repo, and source risk must be visible.
   Loop engineering sources repeatedly warn about cost and review burden. Security reporting on AI coding agents also shows that "popular repo" is not enough; loops must score source trust, avoid blind setup scripts, and prefer read-only research by default.

## Product Line

### 1. Loop Factory

Current v1 turns a goal and product context into a structured loop spec and stores custom loops. Next step: make every generated loop include source gates, safety level, trigger, budget, verifier, evidence receipt, and stop condition.

Default loop contract:

- Goal: what changes or what decision is produced.
- Trigger: manual, schedule suggestion, repo event, inbox event, or external source watch.
- Source policy: allowed sources, latest GitHub rule, competitor domains, excluded sources, trust level.
- Context pack: repo, vault notes, product brief, existing loops, recent commits.
- Actor role: what the loop may inspect or draft.
- Verifier role: how the result is checked independently.
- Safety level: L1 report-only, L2 assisted writes, L3 PR-only with review gate.
- Budget: time, tokens, maximum sources, maximum files touched.
- Evidence: sources read, commands run, files changed, tests/builds, decisions, next action.
- Stop condition: objective proof, manual decision, budget reached, or unsafe uncertainty.

### 2. Loop Doctor

An audit surface for existing MAZos loops. It should score every loop on readiness, risk, and usefulness.

Scoring dimensions:

- Trigger clarity
- Source freshness
- GitHub/latest-push usage
- Human approval point
- Evidence quality
- Verification strength
- Cost boundedness
- Write safety
- Product relevance

This directly answers "what things are useless currently on MAZos." A loop with no clear trigger, weak evidence, no verifier, and no product outcome should be demoted or removed.

### 3. Product Loop Packs

Ship curated loop packs instead of a blank generic loop builder.

Recommended first packs:

- Competitor Intelligence Pack: takes competitor URLs/repos, researches latest product moves, compares against the target project, outputs feature bets and no-copy warnings.
- GitHub Pulse Pack: reads latest pushes, PRs, issues, releases, and action failures before making recommendations.
- PR Babysitter Pack: watches checks/reviews, summarizes failures, proposes fixes, and prepares a receipt.
- Build Doctor Pack: runs local lint/build/test, classifies failures, and drafts the smallest fix plan.
- Revenue Radar Pack: watches pricing pages, Stripe/TODO setup gaps, conversion blockers, and onboarding friction.
- Useless Feature Reaper Pack: finds UI/features with no clear loop, no user outcome, no telemetry/proof, or no current project priority.
- Founder Inbox Pack: turns scattered "do this later" messages into ranked loops with reviewable next steps.

### 4. Loop Receipts

Every loop run should create a compact receipt that can live in repo docs, vault sessions, or the MAZos UI.

Receipt schema:

- `loopId`
- `runId`
- `startedAt`
- `sourceSnapshot`
- `latestGitHubSnapshot`
- `actions`
- `evidence`
- `verification`
- `costEstimate`
- `riskFlags`
- `decisionNeeded`
- `nextRunSuggestion`

This is the bridge between prompt loops and a real operating system.

### 5. Loop Simulator

Before a loop runs, MAZos should simulate what it would read, what it might change, what it would cost, and where it would stop. This keeps the product local-first and safe while still making loops concrete.

Simulation output:

- Expected sources
- Expected commands/connectors
- Files likely touched
- Verification method
- Approval points
- Risk flags
- Estimated runtime/cost

### 6. Loop Store

Not a public marketplace yet. Start as a local product catalog of loop templates grouped by project and job-to-be-done.

Catalog groups:

- Build and ship
- Research and competitor tracking
- Lead quality and revenue
- Reliability and bug triage
- Personal operating system
- Vault and knowledge maintenance

## Product Principles

1. Local-first by default.
   MAZos can draft, simulate, and audit loops locally before any cloud automation exists.

2. Latest source wins.
   For modern tools, competitors, and GitHub-hosted projects, each loop must state the fetch time and latest pushed/released source used.

3. No invisible autonomy.
   Every autonomous-looking loop needs visible safety level, stop condition, and kill switch.

4. Evidence beats confidence.
   The UI should show proof receipts before recommendations.

5. Product-line loops, not random helpers.
   A loop belongs in MAZos only if it improves one of the main products: JobFilter, InkWeave, OpenFlowKit, Zawiya ops, the Vault, or MAZos itself.

## Recommended Next PRs

1. Add Loop Doctor.
   Extend `src/lib/mazos/loopFactory.ts` with `auditLoopReadiness(loop)` and expose readiness grades in the WORK tab.

2. Add Loop Pattern Library.
   Create a typed registry of loop templates with category, product fit, safety level, source policy, verification policy, and default receipt schema.

3. Add Loop Receipts.
   Persist receipt stubs for generated/saved loops so future runs can attach evidence.

4. Add Product Loop Packs.
   Ship the first three curated packs: Competitor Intelligence, GitHub Pulse, and Useless Feature Reaper.

5. Add Loop Simulator.
   Add a dry-run view that previews sources, commands, risk, approval points, and expected output.

## Sources

- Addy Osmani, "Loop Engineering", 2026-06-07: https://addyosmani.com/blog/loop-engineering/
- cobusgreyling/loop-engineering GitHub repository, checked 2026-07-06: https://github.com/cobusgreyling/loop-engineering
- LangGraph interrupts and human-in-the-loop docs: https://docs.langchain.com/oss/python/langgraph/human-in-the-loop
- Temporal event history and durable execution docs: https://docs.temporal.io/workflow-execution/event
- GitHub Actions workflow docs: https://docs.github.com/en/actions/get-started/understand-github-actions
- OpenAI Codex automations docs: https://developers.openai.com/codex/app/automations
- OpenAI Agents SDK handoffs, guardrails, and tracing docs: https://openai.github.io/openai-agents-python/
- OSpec repository, checked 2026-07-06: https://github.com/clawplays/ospec
