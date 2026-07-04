# OpenWiki Local Install

Updated: 2026-07-04

## Installed App

- Source repo: `https://github.com/kdsz001/OpenWiki`
- Local source clone: `C:\Users\manaz\Projects\openwiki`
- Hermes source clone: `C:\Users\manaz\.hermes\external-sources\openwiki`
- MAZos submodule: `external/agent-sources/openwiki`
- Installed app: `C:\Users\manaz\AppData\Local\OpenWiki\OpenWiki.exe`
- Local database: `C:\Users\manaz\AppData\Roaming\com.openwiki.app\openwiki.db`
- Windows scheduled task: `OpenWiki Local Knowledge App`
- Installed version: `v0.3.17`
- Release digest verified for `OpenWiki_0.3.17_x64-setup.exe`:
  `4c0fef09009f2a59c1a29270bd69864fa98fef469b528f7005af53aea944d22d`

## What OpenWiki Is For

OpenWiki is a local-first desktop knowledge app. It captures selected clipboard/content items, compiles them into a personal wiki, stores data in local SQLite, exports Markdown, and exposes the SQLite store through MCP.

Use it for:
- personal knowledge capture;
- saved web/text/image context;
- local wiki pages and graph exploration;
- Markdown export into Obsidian or agent handoff packs;
- MCP-backed querying by Claude Desktop, OpenClaw, Codex, and other MCP-capable agents.

Do not treat it as:
- a replacement for the main Obsidian vault;
- a repo documentation generator;
- an autonomous ingestion bot;
- a private-content scraper.

## Agent Access

MCP server name: `openwiki`

MCP command:

```json
{
  "command": "C:\\Program Files\\nodejs\\npx.cmd",
  "args": [
    "-y",
    "mcp-server-sqlite-npx",
    "C:\\Users\\manaz\\AppData\\Roaming\\com.openwiki.app\\openwiki.db"
  ]
}
```

Configured locations:
- `C:\Users\manaz\AppData\Roaming\Claude\claude_desktop_config.json`
- `C:\Users\manaz\.openclaw\openclaw.json`
- `C:\Users\manaz\.codex\config.toml`

Restart each client after config changes.

## Useful Tables

OpenWiki stores core knowledge in SQLite. Important tables include:
- `captured_content`
- `app_settings`
- `wiki_pages`
- `wiki_page_sources`
- `wiki_edges`
- `wiki_conversations`
- `weekly_reports`
- `report_sections`

Agents should prefer read-only queries unless the user explicitly asks to mutate the OpenWiki database.

## Setup State

Completed:
- Downloaded official Windows x64 release.
- Verified SHA-256 against GitHub release metadata.
- Installed silently.
- Launched OpenWiki once to initialize the database.
- Cloned source to `C:\Users\manaz\Projects\openwiki`.
- Mirrored source to Hermes external sources.
- Added MAZos submodule entry.
- Added MCP config for Claude Desktop, OpenClaw, and Codex.
- Added Windows logon task `OpenWiki Local Knowledge App`.
- Seeded OpenWiki with three wiki pages:
  - `OpenWiki Local Install and Agent Access`
  - `MAZos Agent Access and Market-Breaker Roadmap`
  - `OpenWiki GitHub Capability Summary`

Manual user step still required:
- Open OpenWiki and configure AI provider in Settings -> AI if you want its in-app AI compilation, reports, and Q&A to use Claude/OpenAI/Gemini/Ollama/LM Studio.

## How Agents Should Use It

1. Check whether OpenWiki is running:
   `Get-Process openwiki -ErrorAction SilentlyContinue`
2. Check whether the database exists:
   `Test-Path C:\Users\manaz\AppData\Roaming\com.openwiki.app\openwiki.db`
3. Check whether the logon task exists:
   `Get-ScheduledTask -TaskName "OpenWiki Local Knowledge App"`
4. Use the `openwiki` MCP server for read-only SQLite queries where available.
5. For Obsidian handoffs, use OpenWiki's Markdown export rather than scraping the database manually.
6. Keep MAZos as the operating cockpit and OpenWiki as a capture/wiki source.
