# MazOS Control Deck

Command & Control Interface for MazOS.

## Hermes External Sources

Hermes external agent sources are installed locally at:

`C:\Users\manaz\.hermes\external-sources`

MAZos records the same sources as Git submodules under:

`external/agent-sources`

Registry and instructions:

- `research/mazos/HERMES_EXTERNAL_SOURCES.md`
- `config/external-agent-sources.json`
- live Hermes skill: `C:\Users\manaz\.hermes\skills\external-agent-sources\SKILL.md`

Use these as reference/capability sources only. Do not run global installers, wrap agents, scrape private content, or create recurring loops without explicit confirmation and safety gates.

Installed source families include context compression, web reach, NVIDIA/GPU skills, reusable agent skills, browser automation, recurring loop engineering, and n8n workflow templates. The n8n templates are mirrored as a sparse MAZos submodule because the full repository contains Windows long-path filenames; Hermes should use the full local clone under `C:\Users\manaz\.hermes\external-sources\awesome-n8n-templates`.

OpenWiki is also installed locally as a desktop knowledge capture/wiki source. See `docs/OPENWIKI_LOCAL_INSTALL.md` and `config/hermes_export/OPENWIKI_LOCAL_INSTALL.md`. Its app lives at `C:\Users\manaz\AppData\Local\OpenWiki\OpenWiki.exe`, its SQLite database lives at `C:\Users\manaz\AppData\Roaming\com.openwiki.app\openwiki.db`, and MCP-capable agents can use the `openwiki` SQLite MCP server after restarting their client.

## OpenWiki in MAZos

MAZos exposes OpenWiki as a first-class local knowledge hub at:

`http://127.0.0.1:3046/openwiki`

The page shows app install status, process state, scheduled task state, SQLite counts, latest wiki pages, knowledge gaps, MCP reminders, and copyable Hermes/Codex context prompts. The matching API is:

- `GET /api/mazos/openwiki` for status, counts, health score, latest pages, and prompts.
- `POST /api/mazos/openwiki` with `agent-context`, `launch-prompt`, or `mcp-reminder` for safe copyable outputs.

Because `config/control-panel.yaml` currently has `allow_shell: false`, MAZos does not start OpenWiki from the UI. It returns the launch command for deliberate manual use instead. On the hosted Vercel site, `/openwiki` uses the same local bridge as the rest of MAZos, so Windows-local paths work only when the local app and bridge are running.

## Overview
MazOS Control Deck is a persistent, formalized system providing a React-based UI that interfaces with underlying Hermes skills via YAML configuration files.

## Prerequisites
- Node.js >= 18
- Python >= 3.11
- Hermes Agent

## Installation
Run `.\install.ps1` to provision the environment.

## Operation
```bash
npm start
```
UI available at `http://localhost:9999` (default).

## Hosted Vercel + Local Windows Bridge

The hosted site can run at:

`https://mazos-command-centre.vercel.app`

Vercel cannot directly read `C:\Users\manaz\...` paths from the cloud. To let the hosted site use local repo/vault data, run MAZos locally and start the bridge:

```bash
npm run dev -- -p 3046
npm run bridge
```

The bridge listens on `http://127.0.0.1:3047` and proxies only `/api/mazos/*` to the local app. The hosted UI tries that bridge first when opened from Vercel, then falls back to hosted API data if the bridge is offline.

To auto-start both local processes on Windows login, use the scheduled task:

`MAZos Local Stack`

It runs `scripts/start-mazos-local-stack.ps1`, which starts the local app and bridge only when ports `3046` or `3047` are not already listening.

## Agent Task Gate

MAZos includes an Agent Task Gate at:

`http://127.0.0.1:3046/sessions`

The Task Gate is a preflight system for Hermes/Codex/OpenCode/Aider sessions. It checks the task before an agent starts so bad sessions are caught early.

It scores each task from `0` to `100` using:

- task clarity;
- success criteria quality;
- repo existence;
- dirty repo state;
- build/lint availability;
- forbidden actions;
- safety flags;
- expected files/output;
- MAZos project priority fit;
- broadness;
- whether research should happen first.

Risk levels:

- `safe`: prompt is scoped and ready to launch manually.
- `caution`: prompt needs repair, narrower scope, or extra handoff context.
- `danger`: blocked because the repo is missing or the task includes destructive/credential/private-scraping risk.

The gate never starts a session automatically. `Start Session if Approved` copies the generated prompt so Maz can launch it deliberately. With `config/control-panel.yaml` currently setting `allow_shell: false`, MAZos treats the gate as prompt-only even when validation commands are suggested.

Example flow:

1. Open `/sessions`.
2. Pick a repo.
3. Write the rough task.
4. Add success criteria and expected files if known.
5. Click `Check Task`.
6. Use `Improve Prompt`, `Make Smaller`, or `Generate Mission Plan`.
7. Copy the final prompt into Hermes.

API routes:

- `GET /api/mazos/task-gate`
- `POST /api/mazos/task-gate`
- `POST /api/mazos/mission-plan`

Mission plans also include Source Receipts from `GET /api/mazos/context-map`. The generated Hermes prompt now tells agents which repo/vault/OpenWiki/tool-router sources to read first, how confident each receipt is, and when to stop if evidence contradicts the mission.

Data files:

- `data/mazos/task-gates/latest-task-gate.json`
- `data/mazos/task-gates/task-gate-history.jsonl`
- `data/mazos/mission-plans/*.md`

Safety defaults added when missing:

- no destructive commands;
- no force push;
- no credential changes;
- no global installs;
- no recurring loops;
- no private scraping/auth bypass;
- no GitHub push unless Maz explicitly asks.

## AI Feed

MAZos includes a deterministic AI Feed in the main cockpit `FEED` tab and at:

`GET /api/mazos/feed`

The feed aggregates existing local-first evidence only: Shipping Spine, Decision Inbox events, run history, stale work findings, ship-log commits, intake queue arrivals, and OpenWiki status. It ranks items by shipping impact and answers: what changed since Maz last looked, and whether anything changes what should ship next.

The FEED tab is an **Operator Inbox**: lane-grouped list (Needs Decision, Blocked, Failed Checks, System Pressure, Stale Work, Ready to Ship, Knowledge Gaps, Watch, Done) with a sticky detail pane, topped by a Morning Command Brief (ship next, counts of what needs you, one safest next prompt, one thing to ignore). Item states — unread/seen/saved/snoozed/done/cleared — persist in `data/mazos/feed-state.json` via `POST /api/mazos/feed`.

Ranking is revenue-weighted and **explainable**: every item carries a `scoreBreakdown` (urgency, revenue, blocker, evidence, risk, recency, spine fit, system pressure) and an `evidenceQuality` grade (strong/partial/weak/missing). The detail pane's flight recorder (`GET /api/mazos/flight-recorder?id=...`) replays what was actually logged — runs, human gates, task-gate preflights, mission plans, loop events — and states plainly what was never verified. Every item carries a launch-grade agent prompt (mission, evidence, success criteria, verify commands, forbidden actions, stop-and-ask conditions) plus a `→ Task Gate` action that pre-fills `/sessions` for preflight scoring. UI rules: `docs/MAZOS_DESIGN_DIRECTION.md`.

Safety defaults remain intact: no shell execution, no LLM calls, no external crawling, no cron, no database writes, and no autonomous agent starts. Hosted Vercel degrades through the same local bridge pattern as other MAZos APIs.

## Command Brief, Context Map, and Runtime Safety

MAZos exposes the next operating layer as read-only, agent-usable APIs:

- `GET /api/mazos/morning-brief?project=MAZos` returns a server-side command brief with headline, ship-next, needs-you list, avoid-today guidance, source evidence, Markdown, and the safest next prompt.
- `GET /api/mazos/context-map?project=JobFilter` returns source receipts across repo/vault/OpenWiki/tool-router/verify commands so agents know what to read first and what evidence is sensitive.
- `GET /api/mazos/agent-runtimes?task=...` returns the local runtime registry for Hermes, Codex, Claude Code, OpenCode, and browser agents, with safety ceilings, allowed modes, forbidden actions, validation commands, and a recommended runtime.

The main cockpit shows the server brief and Context Map in `NOW`, and the Agent Runtime Safety Console in `SYSTEM`. These panels do not launch agents or shell commands; they generate operating context and safety guidance for Task Gate and manual agent handoff.

## System Internals

`GET /api/mazos/system` reports the local machine: CPU usage/cores, RAM used/total, GPU VRAM used/total + utilisation + temperature (read-only `nvidia-smi` query, absent on hosted), disk free, and uptime. The cockpit shows it as a compact strip under the header — local mode only; hosted without the bridge hides it. When RAM or VRAM crosses 92% the feed surfaces a memory-pressure attention item so agent runs do not fail for the wrong reason.

## Configuration
System state and skill definitions are maintained in YAML format. The React UI polls these configurations to reflect the current state of Hermes skills.

---
*Minimal viable documentation. See ARCHITECTURE.md for system design.*
