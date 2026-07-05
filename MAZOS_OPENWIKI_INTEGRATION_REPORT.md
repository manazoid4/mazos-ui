# MAZos OpenWiki Integration Report

Date: 2026-07-05

## Summary

OpenWiki is now a first-class MAZos knowledge hub instead of a hidden local install documented only for agents. MAZos exposes a visible `/openwiki` page, a local/bridge-compatible API route, safe prompt actions, service health visibility, and Tool Router awareness.

## What Changed

- Added OpenWiki path constants for the app, database, source clone, Hermes mirror, MAZos submodule, starter script, docs, and MCP server.
- Added `GET /api/mazos/openwiki` for OpenWiki status, counts, health score, latest wiki pages, knowledge gaps, MCP config, and agent prompts.
- Added `POST /api/mazos/openwiki` for safe prompt-only actions: `agent-context`, `launch-prompt`, and `mcp-reminder`.
- Added `/openwiki` UI with status cards, health score, latest pages, knowledge gaps, copyable prompts, launch command, MCP snippet, docs link, and GitHub source link.
- Added dashboard navigation entry: `OPENWIKI`.
- Added OpenWiki to Ops Radar/service health.
- Added OpenWiki to Tool Router for wiki, knowledge, memory, capture, SQLite, MCP, Markdown export, and handoff tasks.
- Updated README and OpenWiki install docs.
- Added `MAZOS_OPENWIKI_NEXT_AGENT_PROMPT.txt`.

## Local Paths

- App: `C:\Users\manaz\AppData\Local\OpenWiki\OpenWiki.exe`
- DB: `C:\Users\manaz\AppData\Roaming\com.openwiki.app\openwiki.db`
- Source: `C:\Users\manaz\Projects\openwiki`
- Hermes source: `C:\Users\manaz\.hermes\external-sources\openwiki`
- MAZos submodule: `C:\Users\manaz\Projects\mazos-ui\external\agent-sources\openwiki`
- Starter script: `C:\Users\manaz\.hermes\openwiki\start-openwiki.ps1`
- MCP server: `openwiki`

## Safety

MAZos respects `config/control-panel.yaml`. With `allow_shell: false`, the OpenWiki cockpit does not launch processes or mutate the SQLite database. It returns copyable prompts and commands only.

Agents should query OpenWiki read-only through MCP/SQLite unless Maz explicitly requests mutation. Obsidian handoffs should prefer OpenWiki Markdown export.

## Current OpenWiki Facts

- OpenWiki process: running locally during implementation.
- Scheduled task: `OpenWiki Local Knowledge App` exists.
- SQLite DB: exists.
- Wiki pages: 3.
- Captured content: 0.

## Validation

- `npm run lint`: passed.
- `npm run build`: passed. Next.js emitted non-fatal Turbopack tracing warnings for the local Windows/Python status helper and root lockfile inference.
- `GET http://127.0.0.1:3046/api/mazos/openwiki`: passed.
- `http://127.0.0.1:3046/openwiki`: returned `200`.

## Next Improvements

1. Add OpenWiki-to-Obsidian export/import buttons that still stay prompt-first unless shell is enabled.
2. Add project-specific OpenWiki seed packs for MAZos, Recall, JobFilter, OpenFlowKit, and Hermes.
3. Add an agent memory diff that compares OpenWiki, Obsidian, GitHub, and MAZos session state before launching tasks.
