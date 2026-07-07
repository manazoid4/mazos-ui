# MazOS Rebuild Report

## Changed files
- `config/control-panel.yaml`
- `src/app/page.tsx`
- `src/app/api/mazos/route.ts`
- `src/app/api/mazos/action/route.ts`
- `src/app/api/mazos/health/route.ts`
- `src/app/api/mazos/ingest/route.ts`
- `src/app/api/mazos/repos/route.ts`
- `src/app/api/mazos/runs/route.ts`
- `src/lib/mazos/paths.ts`
- `src/lib/mazos/commandRegistry.ts`
- `src/lib/mazos/runCommand.ts`
- `src/lib/mazos/repoScanner.ts`
- `src/lib/mazos/serviceHealth.ts`
- `src/lib/mazos/logStore.ts`
- `research/mazos/MAZOS_REBUILD_AUDIT.md`
- `MAZOS_REBUILD_REPORT.md`

## What changed
- Replaced arbitrary shell executor with allowlisted action registry.
- Added run result shape + JSONL logs under `data/mazos/runs/YYYY-MM-DD.jsonl`.
- Added APIs: `/api/mazos/health`, `/api/mazos/repos`, `/api/mazos/runs`, `/api/mazos/ingest`.
- Rebuilt dashboard into cockpit: top mission/status, daily execution, repo centre, Recall ingest, vault/memory, sessions/actions, run console.
- Fixed URL behavior in UI: `/focus` navigates client-side; GitHub opens new tab; local paths copy for manual open.
- Recall ingest now uses JS `fetch` to real Recall endpoints for YouTube/Instagram; queues unsupported/offline URLs.
- Vault scan writes `data/mazos/vault-index.json` + `research/mazos/latest-vault-scan.md`.
- Config updated with repos, vaults, ports, safety toggles, email disabled.

## Local URLs
- MazOS: `http://localhost:3046`
- Recall: `http://localhost:3029`
- JobFilter: `http://localhost:3000`
- Focus: `http://localhost:3046/focus`

## Test results
- `npm run build` → PASS
- `npm run lint` → FAIL: existing script uses `next lint`; Next 16 reports `Invalid project directory provided, no such directory: C:\Users\manaz\Projects\mazos-ui\lint`

## Remaining gaps
- Email still disabled: no local API key/env detected.
- OpenFlowKit path missing.
- Hermes session scanning is prompt/manual fallback; no reliable local session API wired.
- Raw shell intentionally not exposed; enable only via future `MAZOS_ALLOW_SHELL=true` work.
