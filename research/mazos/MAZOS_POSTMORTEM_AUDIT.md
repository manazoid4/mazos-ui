# MazOS Cockpit Postmortem Audit

Date: 2026-06-30

## Verdict

The previous cockpit had the right primitives but wrong product behavior: it exposed local technical state instead of answering “what should Maz do next?”. It looked like a log browser. MazOS needs to be a command cockpit: interpret signals, summarize evidence, route inputs, and hide raw logs until requested.

## User feedback converted to requirements

1. Ops/Service Radar
   - Old issue: implied all projects should be localhost services.
   - Fix: rename to Ops Radar and mix local, cloud, repo, vault signals.
   - Local optional services must show `not-running`, not scary `offline`.
   - Cloud/GitHub should be represented as external status.

2. Intake
   - Old issue: generic URL textarea, weak source handling.
   - Fix: Source Intake supports YouTube, Instagram, X, PDF, webpage.
   - Direct-route only supported Recall APIs; queue everything else with metadata.
   - Add file upload for PDFs/notes using Next.js route-handler `request.formData()` + `File.arrayBuffer()`.
   - Keep queue durable at `data/mazos/ingest-queue.jsonl` and Obsidian inbox.

3. Vault / Memory
   - Old issue: buttons returned dull logs/prompts inline.
   - Fix: generate Vault Intelligence from canonical Obsidian vault.
   - Read required bootstrap docs first: `AGENTS.md`, `wiki/hot.md`, `wiki/index.md`, prompt library, current tasks, project CURRENT files.
   - UI opens modal summaries: doctrine, prompts, key docs, project signals.

4. Repo Command Centre
   - Old issue: action output means reading huge logs.
   - Fix: default action result is a summary modal with first useful lines, next step, and raw output collapsed behind `<details>`.
   - Repo actions remain allowlisted; no destructive commands.

5. Action Groups
   - Old issue: too many buttons with generic grouping.
   - Fix: rename to Action Matrix; “click → summary modal”; group by workflow, not log output.
   - Longer term: promote only 3 recommended actions, demote rest to command palette.

6. Visual style
   - Direction: Jarvis-lite, not complex.
   - References used: Linear + Raycast dark-mode product surfaces.
   - Principles: near-black canvas, subtle grid, translucent panels, mono metadata, minimal violet accent, green/yellow/red signals.

## Implementation decisions

- Do not fake X/PDF direct ingestion. Queue unsupported source types with metadata.
- Do not make optional local services look like system failure.
- Do not dump logs by default; use modal summaries and raw-output details.
- Do not scan entire vault into frontend; server route returns compact extracted signal.
- Do not add dependencies. Use stdlib/Node/Next APIs already present.

## Files changed by remediation

- `src/app/page.tsx`
  - Jarvis-style layout
  - Ops Radar
  - Source Intake with files
  - Vault Intelligence modal summaries
  - Repo summaries over logs
  - Action Matrix

- `src/app/globals.css`
  - full dark cockpit theme
  - modal, radar, intake, repo, action styling

- `src/lib/mazos/serviceHealth.ts`
  - local/cloud/vault signal model
  - optional local services differentiated from critical failures

- `src/lib/mazos/vaultInsight.ts`
  - canonical vault scanner/summarizer
  - extracts doctrine, project signals, prompt-like bullets, key docs
  - writes `vault-index.json` and `latest-vault-scan.md`

- `src/app/api/mazos/vault/route.ts`
  - exposes compact vault intelligence JSON

- `src/app/api/mazos/ingest/route.ts`
  - multipart support
  - URL + PDF/file routing
  - durable queue fallback

## Verification plan

Run:

```bash
cd C:/Users/manaz/Projects/mazos-ui && npm run lint && npm run build
```

Then browser-check:

- `http://localhost:3046`
- `/api/mazos/health`
- `/api/mazos/vault`
- source intake modal behavior

## Remaining product upgrades

1. Command palette (`Cmd+K`) for actions.
2. “Now” recommendation generated from repo + vault + recent run signals.
3. Actual X/PDF extractors wired into Recall when Recall supports them.
4. Email digest route using env-only Resend creds.
5. Persist UI dismissed/priority state locally.
