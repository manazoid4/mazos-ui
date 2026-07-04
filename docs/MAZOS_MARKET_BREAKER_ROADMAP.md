# MAZos Market-Breaker Roadmap

Updated: 2026-07-04
Planning agent: Avicenna (`019f2cb9-8f45-7e73-8a8d-1be68bf7d07f`)

## Product Thesis

MAZos should become the local-first, hosted-accessible AI operating cockpit for shipping Maz's products. It should not be a generic dashboard, chat wrapper, or autonomous agent toy.

The moat is the combination of:
- Hosted Vercel UI for anywhere access.
- Windows-local bridge for private repo, vault, and machine truth.
- Agent-readable operating context shared by Codex, Claude/Hermes, and OpenCode.
- Evidence-first shipping workflows that rank what to ship next, prepare the context, and gate risky work.
- Founder/product memory that survives across agents, sessions, and repositories.

## Strategic Direction

MAZos should answer five questions every time it opens:

1. What should be shipped next?
2. Why does that matter commercially?
3. What evidence supports it?
4. Which agent or human owns the next action?
5. What is blocked, risky, or stale?

Everything that does not help answer those questions should be treated as secondary.

## Next Five Features

### 1. Shipping Spine

A first-viewport operating table that ranks active products and the next shippable action for each.

Each row should show:
- Product.
- Current objective.
- Next shippable action.
- Evidence source.
- Blocker.
- Safety/risk level.
- Owner.
- Done criteria.

Inputs:
- Existing project status.
- Ship log.
- Stale radar.
- Decisions.
- Product playbooks.
- Vault context.

### 2. Product Playbooks

Per-product strategy files that tell agents what good work looks like.

Minimum playbooks:
- JobFilter: lead quality, revenue conversion, competitor displacement.
- Recall: personal AI memory, capture friction, future retrieval value.
- OpenFlowKit: workflow templates, lightweight automation, reusable systems.
- MAZos: command centre, agent coordination, local/private operating layer.

Each playbook should include:
- Audience.
- Paid outcome.
- Moat.
- Current wedge.
- Forbidden bloat.
- Top metrics.
- Current next bet.

### 3. Proof Receipts

A durable evidence trail for every meaningful action.

Receipts should capture:
- What changed.
- Files touched.
- Commands run.
- URLs checked.
- Screenshots or API responses where useful.
- PR/commit links.
- Remaining risks.

This should become the shared truth source for agents instead of relying on chat memory.

### 4. Safe Action Capsules

Prepared, reviewable action bundles for agents.

A capsule should include:
- Goal.
- Scope.
- Allowed files or directories.
- Forbidden actions.
- Required checks.
- Rollback notes.
- Expected user-visible result.

This lets MAZos coordinate useful work without becoming an uncontrolled autonomous runner.

### 5. Founder Revenue Radar

A revenue-focused ranking layer over projects and tasks.

It should score work by:
- Revenue proximity.
- User pain severity.
- Differentiation.
- Shipping effort.
- Evidence strength.
- Risk.

This should push JobFilter and Recall revenue work above cosmetic MAZos polish unless MAZos infrastructure is directly blocking product velocity.

## Recommended Next PR

Build **Shipping Spine v1**.

Scope:
- Add a product manifest/playbook module for JobFilter, Recall, OpenFlowKit, and MAZos.
- Add `/api/mazos/shipping-spine`.
- Combine existing project status, ship log, stale radar, decisions, and product playbooks.
- Replace the softer "What Now" emphasis on the NOW view with a first-viewport Shipping Spine panel.
- Keep writes limited to existing `data/mazos/*` patterns unless a schema change is unavoidable.
- Verify with lint and build.

Definition of done:
- Local MAZos shows the Shipping Spine without needing chat context.
- Hosted MAZos can read it through the local bridge.
- Each product has one concrete next action and visible evidence.
- Agents can use the endpoint as a handoff input.

## Anti-Bloat Rules

- Do not build a generic chat surface.
- Do not add autonomous loops until the evidence model is reliable.
- Do not add CRM, calendar, email, analytics, or automation suites inside MAZos.
- Do not add panels unless they remove decision load.
- Do not call external APIs until local repo/vault evidence is dependable.
- Treat Headroom, Agent Reach, n8n, Maxun, Loop Engineering, and other installed sources as references, not product requirements.
- Every feature must improve shipping clarity, evidence, agent coordination, or revenue prioritization.

## Operating Principle

MAZos wins by becoming the cockpit that knows Maz's products, repos, vault, agents, and shipping history better than any generic AI workspace can.
