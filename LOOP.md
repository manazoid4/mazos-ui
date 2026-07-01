# MAZos Loop Engineering

## Operating thesis
MAZos loops are not “keep agents busy”. They are a morning cockpit: read repo + vault state, surface the highest-leverage commercial next action, stop.

## Active loops

| Loop | Cadence | Level | Status | Scope |
|---|---:|---|---|---|
| MAZos Daily Triage | manual / daily | L1 report-only | active | MAZos, Recall, JobFilter, Hermes/vault state |

## Goal
Give Maz a prioritized, actionable picture of what needs attention today across MAZos/Recall/JobFilter, with evidence from local repo + Obsidian vault.

## Non-goals
- No auto-fixes in week 1.
- No auto-commit/push.
- No deploys, payments, credential/account actions, scraping, or external writes.
- No broad vault/repo loading.
- No architecture invention unless a current blocker demands it.

## Watched sources
- Repo: `C:/Users/manaz/Projects/mazos-ui`
- Vault: `C:/Users/manaz/Desktop/Obsidian Main Vault`
- Read first: `wiki/hot.md`, `wiki/index.md`, `03-MEMORY/PROJECT_INDEX.md`, `03-MEMORY/CURRENT_TASKS.md`, `06-SYSTEM/HERMES_RULES.md`
- Project refs: `02-PROJECTS/MazOS/CURRENT.md`, `02-PROJECTS/Recall/CURRENT.md`, `02-PROJECTS/JobFilter/CURRENT.md`
- Loop state: `STATE.md`
- Run log: `loop-run-log.md`
- Budget: `loop-budget.md`

## Run prompt
```text
Run MAZos Daily Triage.

Rules:
1. Read STATE.md, LOOP.md, loop-budget.md.
2. Read targeted vault context only: hot/index, PROJECT_INDEX, CURRENT_TASKS, HERMES_RULES, then relevant project CURRENT notes.
3. Inspect repo state enough to know current blockers: git status, package scripts, build/lint status only if budget allows.
4. Produce:
   - High Priority: max 3 items
   - Watch: max 5 items
   - Noise/Ignored
   - One recommended next action
   - Evidence paths read
5. Update STATE.md Last run, High Priority, Watch, Recent Noise, Post-run critique.
6. Append one entry to loop-run-log.md.
7. Do not edit app code, commit, push, deploy, email, scrape, or touch credentials.
8. Escalate anything involving accounts, scraping, credentials, deployments, payments, or destructive changes.
```

## Human gates
Human approval required for:
- code edits beyond docs/state
- commits/pushes/PRs
- deploy/runtime process changes
- credentials/accounts/payments
- external scraping or automation
- deleting/renaming files
- enabling L2 assisted fixes

## Stop conditions
Stop after the first true condition:
- STATE.md updated with today’s triage
- 3 high-priority items found
- any human-gated action needed
- 30 minutes elapsed
- 60k estimated tokens used
- same blocker appears for 3 runs without new evidence

## Graduation path
- Week 1: L1 report-only, tune noise.
- After 5 useful runs: allow L2 for docs/state-only cleanup.
- After 10 useful runs: allow isolated worktree fixes, verifier separate from implementer.
- Never allow auto-merge.

## Success metric
A useful run gives Maz one obvious next action that improves Recall, JobFilter, or MAZos commercial leverage.
