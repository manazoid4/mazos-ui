> **Superseded 11 Oct 2026:** Maz chose **Claude Opus 5.5 Extra** as the primary builder with cheaper workers and a voice/wake-word scope. Use [`COMMAND_CENTRE_OPUS_ONE_SHOT_2026-10-11.md`](COMMAND_CENTRE_OPUS_ONE_SHOT_2026-10-11.md) for all new work. This Codex version is retained for history only.\n\n# MAZos Command Centre — Codex/Astra one-shot completion brief
Date: 11 October 2026. Working branch: `agents/personal-command-centre-20261011` in `manazoid4/mazos-ui`.

## Your job
Finish and validate the already-started personal operator dashboard. You have permission to **implement, test, commit and open/update a PR**, NOT to alter running services, rotate credentials, merge, deploy to production, accept work shifts, send outreach or modify client systems without explicit approval. Work autonomously inside those boundaries. Give Maz one short report at the end, not iterative questions. Do not create another app, Paperclip installation, vault, agent runtime, or database.

Main interface: local-first MAZos. Existing Call Desk stays at `/call-desk`. Current draft `/command-center` integrates `/api/mazos/shipping-spine`, `decisions`, `runs`, `repos`, `health` and generates copyable, memory-aware agent briefs. The root opens the new cockpit on the work branch. E2E mock/offline tests exist. The branch is **not yet a tested release**.

## Prerequisites: reality audit (small context)
1. Read `unified-memory-database/INDEX.md` and ONLY pertinent project statuses: `projects/zawiya-trust-demo/STATUS.md`, `projects/ilm/STATUS.md`, `projects/maz-works/STATUS.md`, `handoffs/INDEX.md` and recent relevant session handoffs. Cross-check sources rather than copying stale entries.
2. Read `mazos-ui/README.md`, `ARCHITECTURE.md`, `docs/MAZOS_DESIGN_DIRECTION.md`, `docs/product-reset/DESKTOP_ACCEPTANCE_MATRIX.md`, `src/lib/mazos/*` only as needed. Inspect `maz-agents/README.md` and `docs/ARCHITECTURE.md`, `agent-nudge` read-only surfaces, `maz-works-knowledge-vault` canonical file rules, `nod`, `mazos-site` and active project status. Preserve repo ownership; AgentDock is a separate enterprise PRODUCT, not this personal control plane.
3. Check local files, Git worktrees, installed tasks, Hermes profiles, gateways, PR state, and MAZos backend mode before changing integrations. Respect current machine environment, including the new HP laptop path variability. Never assume hardcoded `C:/Users/manaz` exists elsewhere.

## Problems already observed from GitHub inspection
- `mazos-ui/main` opened Call Desk only, hiding the operator cockpit. This branch restores it through a new route.
- `config/tracked-repos.json` observes six historical repos but omits current work such as `mazos-site`, `zawiya-growth-hub`, `maz-agents`, `nod`, `maz-pay`, `flipsignal` and unified memory. Discover local paths through a validated registry; don't add missing paths as if online.
- Existing `config/agents.json` contains generic advisor/critic/validator, not the actual ILM/Scout/Hermes/Codex/Claude ecosystem. Build a merged **capability directory** from real sources; do not treat configured as online.
- `unified-memory-database/projects/ilm/STATUS.md` (9 Oct) lists Gemini routes and Telegram blocker; `maz-agents/docs/ARCHITECTURE.md` (11 Oct) documents OVH Qwen + 9router OpenRouter free. Explicitly reconcile actual machine state and annotate stale evidence rather than silently overwriting.
- `maz-works-knowledge-vault/NOW.md` is dated 25 Sep, partly inconsistent with newer handoffs; prefer fresh provenanced records and display the source date.
- `serviceHealth.ts` used to declare the vault online without checking. Branch adjusts that; review broader fake-health indicators (e.g. `toolkit` equating config with connectivity).
- `/api/mazos/stats` returns null for model spend/context: render “unavailable”, **never estimate** arbitrary usage or subscription credits.
- MAZos desktop acceptance checks are documented as pending. CI/headless builds do NOT prove graphical installation works.

## Build goals — ranked (complete as much as possible inside this pass)
**P0, required**
A. Make new overview beautiful and accessible, tailored to real work: one obvious priority, next actions per project, actual approval inbox, agent directory, brief composer, truthful run-history, source freshness and local machine signal. Follow the existing warm light MAZos design direction, preserving the quietly cinematic JARVIS feel without dark-neon gimmicks, cards for decoration, invented gauges or fake badges. Inspect mobile 390px and desktop 1440px. Functional keyboard focus, labels, contrast and reduced-motion behavior.
B. Fix compilation, typechecking, UI tests, root and Call Desk navigation. Add error boundaries for individual panels; no spinner hanging forever; honest offline/error states. Do not remove existing routes, processes, APIs or safeguards.
C. Add read-only adapters for actual registered ILM/Hermes, Scout, Codex, Claude, Agent Nudge and Unified Memory that expose `configured / reachable / working / stale / error / unknown` only when backed by evidence, `observedAt`, `source`, model id if actually reported, current objective, receipt or PR link. Distinguish local process heartbeat, CLI configured, recent session, and cloud service. Do not scrape secrets, tokens, private contact details, shell history or raw model transcripts; do not scan arbitrary user paths. No polling above 15-second cadence; pause hidden tabs; bound timeouts; zero background GPU load.
D. Make **current** projects visible: Maz Works lead generation and site, Zawiya Trust demo, ILM/Scout, nod/MAZ Pocket, Maz Pay, FlipSignal as relevant, alongside any already registered MAZos/JobFilter work. Use small source-aware ranker: next action / why / owner / evidence / timestamp / confidence / blocked. Let Maz pin top 3 without polluting the source-of-truth; never copy private leads into public repos. Keep personal lists local.
E. The one-input command should be genuinely useful: e.g. “Ask ILM to research this and attach a sourced brief,” “Have Codex audit Zawiya,” “Send the result to Claude for independent review.” Reuse existing `maz-agents` inbox + four-digit go/approval handshake and task interfaces *if confirmed functional*; else keep reliable copy/send-to-existing-agent shortcuts and say “not connected”. Never display “dispatched” on mere copy. Actions with external effects must have a clear, scoped human confirmation; no auto-spend, auto-merge, auto-outreach, auto-shifts.
F. First-run should be easy: reuse the current MAZos launcher/desktop workflow, add one small startup and diagnostics routine where necessary. No Docker, new auth provider, hosted DB or mandatory external API keys; preserve installed Hermes and MAZ Core. Keep offline-capable and ready for HP laptop migration.

**P1, only after P0**
G. Agent run detail (source → subagent/model → task → tests → PR → owner approval), concise logs with read-only links to the actual run evidence; avoid heavy Langfuse self-hosting for this MVP.
H. Practical user shortcuts: “Review today's work”, “What can earn money this week?”, “What's stuck waiting for me?” and “Resume the last agent handoff.” These should compile short sourced briefs, not start an extra agent network.
I. Voice as a **push-to-talk optional affordance** reusing nod/MAZ Core ONLY if genuinely available. Don't rebuild a competing voice assistant, keep mic opt-in, never always-listen.
J. Cheap model-routing directory: Astra/Opus for high-stakes design + final independent review; existing free/local models for triage, scouting, normalization. Check installed/current model access and quotas first. Pricing/usage must reflect actual provider source. Respect ILM free-only guard, local VRAM constraints, token caps. Multi-agent only where tasks are independent; limit number of parallel workers and aggregate evidence.

## Research-backed design/architecture
- Linear Inbox: one selection + details, not a control-panel wall: https://linear.app/docs/inbox
- Raycast AI Commands: reusable natural-language actions with safe tool boundaries: https://manual.raycast.com/ai/ai-commands
- Langfuse: traces as individual work units with durable session association: https://langfuse.com/docs/observability/best-practices
- Vercel agent orchestration: least complex capable workflow; agent swarms can cost far more tokens: https://vercel.com/i/agent-orchestration-patterns
- Paperclip: reference for budgets/approval/heartbeat, NOT an installation mandate: https://github.com/paperclipai/paperclip
- Current official model docs (verify what user's subscriptions actually unlock): https://developers.openai.com/api/docs/models/gpt-6-astra and https://platform.claude.com/docs/en/models/opus-5-5/overview

## Orchestration and QA
Use GPT-6 Astra as the coordinator/architect if available. Spawn 2–3 cheap independent workers ONLY for (1) reality/adapter audit, (2) UX/accessibility QA, (3) test and risk review; do not have multiple agents edit the same files. Use Opus 5.5 or another independent capable reviewer if already accessible without purchasing a new subscription. Protect tokens/cost caps. Read the workers' evidence; fix disagreements with specific file/test proof.

Non-negotiable controls: no root shell from browser, no generic arbitrary `exec` endpoint, no localhost SSRF, no GitHub PR merge, deployment, money, social posts, client access, device flash, system service mutation, scheduling shifts or approval of shifts without explicit owner permission. No raw credentials in logs, status or prompts. No public exposure of private CRM, Zawiya committee facts or personal data. Existing four-digit handshake, worktree locks, Agent Nudge conflicts and MAZos decisions should remain authoritative where supported.

## Acceptance checklist
- `npm ci` then `npm test`, `npm run lint`, `npm run build`, `npm run test:ui`, `npm run check:desktop` and relevant Windows desktop backend checks where runtime available.
- E2E: real-source and offline state, no mock data shown as live, invalid source, data freshness/stale state, copy vs dispatch, navigation to existing Call Desk, human approval boundaries, mobile viewport and keyboard flow, service restarts and Windows path variation.
- Show BEFORE/AFTER screenshots or a preview built from real non-sensitive fixtures; independent critique then remediate the top 3 findings.
- Keep the app local-only if authenticated hosted bridge isn't safe. Do not declare full release readiness until `DESKTOP_ACCEPTANCE_MATRIX.md` is validated on an installed Windows artifact.
- Commit to the isolated feature branch; update the existing draft PR with full test transcript, screenshots, known gaps, rollback instructions, and short sourced handoff. Merge/release only on explicit Maz approval.
- Update bounded source-of-truth handoff in `unified-memory-database` on a separate branch or an approved workflow. Don't bulk rewrite history, public vault or stale snapshots.

## Final output to Maz
Three sentences plus links: **what now works**, **what was verified** (and what wasn't), **the single next action**. Explain in simple terms how to open the dashboard. No roadmap essay, no request for Maz to manually edit files.
