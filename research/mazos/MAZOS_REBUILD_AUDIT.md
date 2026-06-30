# MazOS Rebuild Audit

## Current fake/broken buttons
- `scan_last_5_sessions`: echo-only prompt, no session scan.
- `market_research_brief`: Bash heredoc Python; brittle on Windows.
- `obsidian_immersion_plan`: Bash heredoc Python; brittle on Windows.
- `refresh_vault_index`: points at `C:/Users/manaz/MazOS-Agents/...`; not validated.
- `custom_command`: arbitrary shell via `exec`; unsafe.
- `open_url`: button never navigates; skipped command executor but no client navigation.
- `update_github_repos`: includes `git push`; unsafe for cockpit default.

## Recall ingest failure
- `/api/mazos/action` creates inline `python - <<'PY'` command and posts to Recall.
- Windows rule forbids heredocs; shell quoting brittle.
- Recall does have real endpoints:
  - `POST http://localhost:3029/api/sources/youtube` body `{ urls: [] }`
  - `POST http://localhost:3029/api/sources/instagram` body `{ urls: [] }`
- Generic/TikTok/X have no detected Recall endpoint; must queue fallback.

## Existing MazOS API routes
- `/api/mazos`
- `/api/mazos/action`
- `/api/mazos/agents`
- `/api/mazos/email`
- `/api/mazos/email-digest`
- `/api/mazos/focus`

## Local ports checked
- `3000`: up
- `3029`: up (Recall)
- `3044`: down/timeout
- `3046`: up (MazOS)

## Valid repo/vault paths
- `C:/Users/manaz/Projects/mazos-ui`: exists
- `C:/Users/manaz/Projects/recall`: exists
- `C:/Users/manaz/Desktop/JobFilterV1`: exists
- `C:/Users/manaz/Projects/JobFilterV1`: missing
- `C:/Users/manaz/Projects/openflowkit`: missing
- `C:/Users/manaz/Desktop/Obsidian Main Vault`: exists
- `C:/Users/manaz/JobFilter-Obsidian-Vault`: exists

## Safe automation now
- repo status/lint/build only when script exists
- health checks via `fetch`
- Recall YouTube/Instagram ingest via real API when online
- fallback ingest queue JSONL + Obsidian inbox note
- vault lightweight index by filenames/mtime only
- generated copy-paste prompts for Hermes/session/manual tasks

## Keep manual
- git push/deploy/destructive cleanup
- raw shell unless `MAZOS_ALLOW_SHELL=true`
- email until env/API key configured
- unknown service start commands when package scripts ambiguous
