# OpenWiki Local Install

Updated: 2026-07-04

OpenWiki is installed and available as a local-first knowledge capture/wiki source.

## Paths

- Source repo: `https://github.com/kdsz001/OpenWiki`
- Local source clone: `C:\Users\manaz\Projects\openwiki`
- Hermes source clone: `C:\Users\manaz\.hermes\external-sources\openwiki`
- MAZos submodule: `C:\Users\manaz\Projects\mazos-ui\external\agent-sources\openwiki`
- App executable: `C:\Users\manaz\AppData\Local\OpenWiki\OpenWiki.exe`
- SQLite database: `C:\Users\manaz\AppData\Roaming\com.openwiki.app\openwiki.db`
- Windows scheduled task: `OpenWiki Local Knowledge App`

## Agent Access

MCP server name: `openwiki`

The MCP server uses:

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

Configured clients:
- Claude Desktop config: `C:\Users\manaz\AppData\Roaming\Claude\claude_desktop_config.json`
- OpenClaw config: `C:\Users\manaz\.openclaw\openclaw.json`
- Codex config: `C:\Users\manaz\.codex\config.toml`

Restart clients after config changes.

## Use Policy

Use OpenWiki for selected capture, local SQLite-backed wiki pages, Markdown export, and agent-readable knowledge context.

Do not use it for silent hoarding, private scraping, credential capture, or replacing the main Obsidian vault.

Manual step: configure OpenWiki Settings -> AI with the preferred provider if in-app AI features are needed.

Seeded pages in OpenWiki:
- `OpenWiki Local Install and Agent Access`
- `MAZos Agent Access and Market-Breaker Roadmap`
- `OpenWiki GitHub Capability Summary`
