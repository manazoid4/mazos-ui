# Changelog

All notable changes to MAZos are documented here, newest first.

## 2026-07-18 — v2 Loop Cockpit rebuild

### Changed
- **One screen, no tabs**: Ship Next (spine) → Loop Deck → Decisions → Shipped. `/research`, `/sessions`, `/openwiki` pages deleted; `/hermes` unchanged.
- **The Loop primitive**: every loop = goal + repo + required verify action + PLAN/BUILD prompt split + machine receipts (verify exit code, commit range, diff stat, criteria tamper hash). Completion refused without a passing receipt and all criteria passing.
- **Machine receipts replace click telemetry**: "Log receipt" runs the registered verify command and inspects git — you cannot click your way to a completed loop. Trust badge at ≥5 passing receipts; circuit breaker on repeated identical failure; 3-day zombie auto-stop.
- **New Loop drawer** gated by task scoring; Ship Next rows prefill it (props, not the old unread localStorage handoff).

### Fixed
- **runCommand could never run npm on Windows** (spawn without shell → npm.cmd ENOENT). Wrapped in `cmd /c`; per-repo `verify_*` actions now actually execute.
- Repo paths corrected (JobFilter → `C:/Users/manaz/JobFilterV1`, openflowkit → `C:/Users/manaz/openflowkit`); FlowLens cloned locally and given a playbook so the revenue product finally ranks in the spine.
- Zombie daily_triage loop stopped at the event-log layer.
- Bridge CORS locked to an origin allowlist (was `*`); startup script prefers the production server when a build exists.

### Removed
- ~6,300 LOC: feed, morning-brief, flight-recorder, clutter-reaper, agent-runtimes, ai-source-inbox, ingest, skill-factory, loop-store, trust, mass-competitors, competitor-radar, research surface, remote/email routes, openwiki page, sessions page (task scoring lives on as the loop gate), system strip, ops radar orbs, Loop Doctor, 11-pattern picker, `.ralph/`, leaked remote-intents data file (rotate the key).

## 2026-07-08

### New Features
- **Hermes Profiles panel**: manage Hermes AI profiles right from the cockpit — view every profile, edit its memory/rules docs, and switch which one is active without touching a config file by hand.

## 2026-07-07 — Light theme, AI intelligence engine, loop factory polish

### New Features
- **Light theme redesign**: a full youmind-inspired light theme, alongside the existing dark cockpit.
- **AI Intelligence Engine**: automatically extracts, classifies, dedupes, and scores research links, then turns the good ones into ready-to-run skill/pack suggestions.
- **Clutter Reaper loop**: a one-click loop that finds and clears out stale, low-value cockpit clutter.
- **Radar-to-loop**: turn any research card straight into a pre-filled Loop Factory draft in one click.
- **Pattern-picker-first Loop Factory**: pick a proven pattern first, then fill in the specifics — faster loop creation.
- **Mass Competitor Catalog** and **Competitor Research Roadmap**: broader, more structured competitor tracking.
- **Remote MAZos data layer**: cockpit data now syncs for remote/hosted access.
- **Declutter — one verdict**: panels collapsed down to a single, receipts-gated verdict instead of scattered signals.

### Improvements
- Automated test coverage added for the new AI Intelligence Engine (URL extraction, classification, dedupe, scoring, skill/pack generation).

## 2026-07-06 — Loop factory, feed, and safety layer

### New Features
- **MAZos Loop Factory**: build and launch automation loops from the cockpit.
- **Loop Doctor audits** and **Loop Receipts**: every loop run now gets audited and leaves a verifiable receipt trail.
- **Product Loop Packs**: bundled, ready-to-use loop sets.
- **MAZos Research Console**: dedicated research workspace inside the cockpit.
- **Context Map + runtime safety layer**: visualizes what context an agent has and adds a safety check before it acts.
- **Context receipts on mission plans**: every generated mission plan now shows exactly where its context came from.
- **Operator inbox, flight recorder, explainable ranking**: the AI feed got a proper inbox view, a full activity recorder, and ranking you can inspect (not a black box).
- **UI declutter**: cockpit trimmed to 5 focused tabs with a single "NOW" surface; dead panels removed.
- **CI build check + auto-merge pipeline**: every change is now build-checked automatically before merging (mirrors the JobFilter setup).

### Fixes
- Fixed local dev origin being blocked in some setups.

## 2026-07-05 — AI feed launch

### New Features
- **MAZos AI Feed**: a live feed of AI/agent research and signals, with revenue ranking and a system-internals view built in.
- **OpenWiki cockpit**: local knowledge base status and controls surfaced directly in the cockpit.

## 2026-07-04 — Shipping Spine

### New Features
- **Shipping Spine v1**: product playbooks, a dedicated API, and a first-viewport panel for tracking what's actually shipping.
- **Agent Task Gate + Mission Planner**: validates a task before you launch an agent session on it, and can generate a full mission plan.

### Fixes
- Fixed a 500 error on the hosted (Vercel) Shipping Spine caused by trying to write a snapshot to a read-only filesystem.

### Docs
- Documented MAZos access, roadmap, and OpenWiki local agent setup.

## 2026-07-01 to 2026-07-03 — Cockpit rebuild

### New Features
- **Cockpit rebuild**: reworked command-center UI with a tabbed layout, command palette, and four new panels.
- **Loop engineering deck**, **project status lookup**, **Hermes external agent sources** wired into the cockpit.
- **Hosted local bridge**: lets the hosted (Vercel) cockpit reach Windows-local paths and services.

### Improvements
- Prepared MAZos for Vercel deployment; auto-start script added for the local stack.

## 2026-06-26 to 2026-06-30 — Initial build

### New Features
- **First cockpit release**: live client dashboard with real buttons/toggles driven from YAML/JSON config.
- **Focus actions and timer**, **email digest with markdown fallback**.
- **Control deck widgets** and **vault memory controls**.
