# MAZos Multi Deep Research Index

Date: 2026-07-06
Branch: `agents/multiple-deep-research`
Baseline: MAZos `main` at `ae50e23`

## Research Tracks

1. Workflow automation and AI ops competitors
   - File: `research/mazos/DEEP_RESEARCH_WORKFLOW_AUTOMATION_2026-07-06.md`
   - Question: what should MAZos learn from n8n, Dify, Activepieces, Gumloop, Zapier, Make, Lindy, Relay, and GitHub Actions?

2. Agent runtime and loop-engineering best practices
   - File: `research/mazos/DEEP_RESEARCH_AGENT_RUNTIME_LOOP_ENGINEERING_2026-07-06.md`
   - Question: what is the best loop architecture for MAZos, using current loop-engineering, LangGraph, Temporal, OpenAI Agents SDK, Codex Automations, and OSpec signals?

3. Coding-agent product landscape
   - File: `research/mazos/DEEP_RESEARCH_CODING_AGENT_PRODUCTS_2026-07-06.md`
   - Question: what product lessons should MAZos take from OpenHands, opencode, Codex, Cline, Continue, Aider, Cursor, Devin, Replit, and related tools?

4. MAZos usefulness audit
   - File: `research/mazos/DEEP_RESEARCH_MAZOS_USEFULNESS_AUDIT_2026-07-06.md`
   - Question: what in MAZos is useful, weak, or currently not useful enough?

## Executive Synthesis

MAZos should not try to become a generic Zapier/n8n clone or a full coding IDE. The durable wedge is narrower and stronger:

> MAZos is a local-first operating cockpit that turns scattered project state, competitor research, GitHub activity, vault memory, and agent work into safe, receipt-backed loops.

The next product line should be:

1. Loop Doctor
   - Scores every loop and cockpit surface for trigger clarity, latest-source policy, evidence, verifier, stop condition, and business value.

2. Product Loop Packs
   - Curated packs for Competitor Intelligence, GitHub Pulse, PR Babysitter, Build Doctor, Revenue Radar, Useless Feature Reaper, and Founder Inbox.

3. Loop Receipts
   - A standard receipt schema for sources, commands, run evidence, cost, risk, decisions, and next run.

4. Loop Simulator
   - Dry-run preview of what a loop would read, touch, cost, and ask before it runs.

5. Loop Inbox
   - A triage queue for loop findings, not generic notifications.

6. Loop Store
   - Local catalog of proven project-specific loops. Start private/local, not marketplace.

## Concrete Next Build Order

1. Add a typed `loopPatterns.ts` registry.
   Each pattern should include category, safety level, trigger, source policy, latest-GitHub requirement, verifier, evidence fields, stop condition, and default receipt schema.

2. Add `auditLoopUsefulness()` and show Loop Doctor scores in the WORK tab.
   This directly answers which MAZos loops are useless or under-specified.

3. Add Product Loop Packs.
   Ship three first: Competitor Intelligence, GitHub Pulse, and Useless Feature Reaper.

4. Add Loop Receipts.
   Persist generated loop receipts under `data/mazos/loop-receipts/` and surface them in Flight Recorder.

5. Merge weak surfaces.
   Keep Flight Recorder, Context Map, Feed, Shipping Spine, Task Gate, and Loop Factory. Merge or demote Action Matrix, raw Ship Log preview, and standalone Tool Router unless they feed loop receipts.

## Source Freshness Rule

For all modern products, agent frameworks, or GitHub repos, this research used live web/GitHub data on 2026-07-06. Future research loops should record:

- Fetch date and time.
- Source URL.
- GitHub repo full name.
- Stars/forks.
- `pushed_at`.
- License.
- Why the source should be trusted.

