# MazOS UI agent rules

- Canonical Obsidian vault: `C:/Users/manaz/Desktop/Obsidian Main Vault`.
- For serious work, read first: `wiki/hot.md`, `wiki/index.md`, `03-MEMORY/PROJECT_INDEX.md`, `03-MEMORY/CURRENT_TASKS.md`, `06-SYSTEM/HERMES_RULES.md` when present.
- Search before assumptions. Never claim remembered prior work unless the source file/session was read.
- Keep context small: indexes first → targeted search → only top relevant notes.
- Write session summaries to `04-SESSIONS/YYYY-MM-DD-project-session.md`.
- Append dated sections to decisions/tasks; do not overwrite notes unless backed up.
- Prefer targeted grep/search over loading huge files.
- GitHub update rule: before handoff, run status/build, commit/push when changes are intended, show direct repo URL.
- MAZos local app: `http://127.0.0.1:3046`.
- Hosted MAZos: `https://mazos-command-centre.vercel.app`.
- Hosted-to-local bridge: `http://127.0.0.1:3047`, proxies only `/api/mazos/*` to the local app so the hosted site can read Windows-local repo/vault paths.
- Windows scheduled task: `MAZos Local Stack`. It runs at user logon and starts both the local app and bridge if ports `3046`/`3047` are not already listening.
- To start manually from `C:/Users/manaz/Projects/mazos-ui`: run `npm run dev -- -p 3046` and `npm run bridge`.
- Agent access check: `GET http://127.0.0.1:3047/health`, then `GET http://127.0.0.1:3047/api/mazos/repos`.
- Shipping Spine (what to ship next, per product, with evidence + handoff prompts): `GET http://127.0.0.1:3047/api/mazos/shipping-spine`. Snapshot also written to `data/mazos/shipping-spine.md`. Read this before asking what to work on.
- OpenWiki local knowledge app is installed at `C:/Users/manaz/AppData/Local/OpenWiki/OpenWiki.exe`; source clone is `C:/Users/manaz/Projects/openwiki`; database is `C:/Users/manaz/AppData/Roaming/com.openwiki.app/openwiki.db`; MCP server name is `openwiki`. Read `docs/OPENWIKI_LOCAL_INSTALL.md` before using it.
- Relevant external ref: `https://github.com/witt3rd/oh-my-hermes` for Hermes state-file/plugin patterns.
